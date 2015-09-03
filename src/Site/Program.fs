#if INTERACTIVE
#!/usr/bin/env fsharpi
// for Suave
#r "packages/Suave/lib/net40/Suave.dll"

// for Logary (v3.x)
#I "packages/Newtonsoft.Json/lib/net45/"
#I "packages/FSharp.Actor-logary/lib/net40/"
#I "packages/NodaTime/lib/net35-Client/"
#r "packages/NodaTime/lib/net35-Client/NodaTime.dll"
#r "packages/Logary/lib/net40/Logary.dll"
#r "packages/Logary.Adapters.Suave/lib/net40/Logary.Adapters.Suave.dll"
#endif
module McStreamy

open System
open System.IO
open Suave
open Suave.Types
open Suave.Web
open Suave.Http
open Suave.Http.Applicatives
open Suave.Http.Successful
open Suave.Http.Writers
open Logary
open Logary.Targets
open Logary.Suave
open Logary.Configuration

let logManager =
  withLogary' "McStreamy" (
    withTargets [
      Console.create Console.empty "console"
    ] >>
    withRules [
      Rule.createForTarget "console"
    ])

let suaveConfig =
  { defaultConfig with
      logger = SuaveAdapter(logManager.GetLogger "Suave")
      homeFolder = Some (Path.GetFullPath "build/public/") }

module Chat =
  open Chiron
  open NodaTime

  module DTOs =
    open Chiron.Operators // this tends to overwrite >>= from Suave

    type Message =
      { userName : string
        message : string
        timestamp : Instant
        messageId : string }

      static member FromJson (_ : Message) =
        (fun user msg ts mid ->
          { userName = user 
            message  = msg
            timestamp = NodaTime.Text.InstantPattern.ExtendedIsoPattern.Parse(ts).Value
            messageId = mid })
        <!> Json.read "userName"
        <*> Json.read "message"
        <*> Json.read "timestamp"
        <*> Json.read "messageId"

      static member ToJson (m : Message) =
        Json.write "userName" m.userName
        *> Json.write "message" m.message
        *> Json.write "timestamp" (sprintf "%O" m.timestamp)
        *> Json.write "messageId" m.messageId

    type ControlFlow =
      | Retry
      static member ToJson (c : ControlFlow) : Json<unit> =
        Lens.Json.setLensPartial Json.StringPLens "retry"

  open DTOs

  let stubMessages = [
    { userName = "haf"; message = "Hej tomtegubbar slå i glasen"; timestamp = SystemClock.Instance.Now; messageId = "sha1hash" }
    { userName = "ademar"; message = "w00t does that mean??"; timestamp = SystemClock.Instance.Now.PlusTicks(1L); messageId = "sha1hash" }
  ]

  module History =
    type Container<'a> =
      { values : 'a []
        pos    : uint16
        len    : uint16 }

    let create (len : uint16) =
      { values = Array.zeroCreate (int len)
        pos    = 0us
        len    = 0us }

    let add c x =
      let pos' = c.pos % uint16 c.values.Length
      Array.set c.values (int pos') x
      { c with pos = pos' + 1us
               len = if pos' < c.pos then c.len else c.len + 1us }

    let read (c : Container<'a>) =
      let clone = c.values.Clone() :?> 'a []
      let rec reader remaining pos = seq {
        if remaining <> 0us then
          let pos' = pos % uint16 c.values.Length
          yield c.values.[int pos']
          yield! reader (remaining - 1us) (pos' + 1us)
        }
      reader c.len (c.pos + (uint16 c.values.Length - c.len))

  module HubAndSpoke =
    open Suave.Tcp
    open Suave.Sockets
    open Suave.Sockets.Control
    open Hopac
    open Hopac.Stream
    open Hopac.Infixes // this tends to overwrite >>= from Suave
    open Hopac.Alt.Infixes
    open Hopac.Job.Infixes
    open Hopac.Extensions

    let private logger = Logging.getLoggerByName "McStreamy.Chat.HubAndSpoke"

    type Op =
      | Broadcast of Message
      | ReadHistory of Ch<Message seq>

    type T<'Msg> = T of cmds:Ch<'Msg> * multicast:Src<Message>

    let broadcast (T (cmdChan, _)) (msg : Message) =
      cmdChan <-- Broadcast msg |> queue

    let create () =
      let cmdChan = ch ()
      let messages = Src.create ()
      let rec server history =
        job {
          let! msg = Ch.take cmdChan
          match msg with
          | Broadcast msg ->
            do! msg |> Src.value messages
            return! server (msg |> History.add history)
          | ReadHistory replChan ->
            do! replChan <-+ History.read history
            return! server history
        }
      server (History.create 40000us) |> Job.server |> queue
      T (cmdChan, messages)

    let subscribe (T (_, messages)) =
      let rec loop (streamPos : Promise<Cons<_>>) (conn : Connection) = socket {
        let! next =
          streamPos
          |> Promise.read
          |> Async.Global.ofJob
          |> SocketOp.ofAsync // noteworthy: this will hold the socket open until there's a message

        match next with
        | Nil ->
          LogLine.create' Info "no more log messages" |> Logger.log logger
          return () // close socket
        | Cons (msg, xs') ->
          let msgJson = msg |> Json.serialize |> Json.format
          do! EventSource.mkMessage msg.messageId msgJson |> EventSource.send conn
          return! loop xs' conn
      }
      loop (Stream.Src.tap messages) // |> Stream.values)
      // TODO: https://github.com/haf/suave-presentation.2015-09-03/commit/037422a38b4d528b1e5e7acb7319809ed9edf028#commitcomment-13043991
      // GET ../subscribe still returns ALL previous events

    let history (T (inChan, _)) =
      Alt.guard (
        let replChan = ch ()
        inChan <-+ ReadHistory replChan >>%
        replChan
      ) |> Async.Global.ofJob // adapter to Suave's async

    // You can do timeouts like such:
    //timeOut (TimeSpan.FromDays 1.) >>%? Error "no chat messages received for a day"

  module Utils =
    open Hopac

    let inline deserialise (fn : 'a -> WebPart) : WebPart =
      request (fun r ->
        r.rawForm
        |> Suave.Utils.UTF8.toString
        |> Json.parse
        |> Json.deserialize
        |> fn)

  let api =
    // Single static global hub for this process; not load balanced.
    // To support distr. system, add e.g. Raft/Viewstamped-Replicated-Log, let it
    // ACK before ACK-ing to client, appending to multicast stream.
    let hub = HubAndSpoke.create ()

    let readHistory ctx = async {
       let! msgs = HubAndSpoke.history hub
       return! OK (Array.ofSeq msgs |> Json.serialize |> Json.format) ctx
      }

    setMimeType "application/json; charset=utf-8" >>= choose [
      path "/api/chat/send" >>= Utils.deserialise (HubAndSpoke.broadcast hub >> (fun _ -> CREATED "\"ACK\""))
      path "/api/chat/messages" >>= readHistory
      path "/api/chat/subscribe" >>= EventSource.handShake (HubAndSpoke.subscribe hub)
    ]

    //path "/api/chat/messages" >>= OK (stubMessages |> Json.serialize |> Json.format)

startWebServer suaveConfig <|
  choose [
    Chat.api
    Files.browseHome // first see if you find the file in requested
    Files.browseFileHome "index.html" // always serve index.html by default
    ServerErrors.INTERNAL_ERROR "Please place your index.html in the right folder"
  ]