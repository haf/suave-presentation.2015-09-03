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
            timestamp = NodaTime.Text.InstantPattern.GeneralPattern.Parse(ts).Value
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

  open DTOs

  let stubMessages = [
    { userName = "haf"; message = "Hej tomtegubbar slå i glasen"; timestamp = SystemClock.Instance.Now; messageId = "sha1hash" }
    { userName = "ademar"; message = "w00t does that mean??"; timestamp = SystemClock.Instance.Now.PlusTicks(1L); messageId = "sha1hash" }
  ]

  module HubAndSpoke =
    open Suave.Tcp
    open Suave.Sockets

    type Op =
      | Message of Message
      | AddClient of string
      | RemoveClient of string

    //type T = T of Ch

    let create () =
      // let cmdChan = ch ()
      let rec server state =
        job {
          let! msg = cmdChan |> Ch.recv
          match msg with
          | Message msg ->
            do! stream |> Stream.cons msg
            return! server state
          | AddClient client ->
            return! server state
          | RemoveClient client ->
            return! server state
        }
      server cmdChan [] // |> queue
      cmdChan

    let subscribe hub conn =
      socket {
        return ""
      }

  let api =
    let hub = HubAndSpoke.create ()

    setMimeType "application/json; charset=utf-8" >>= choose [
      path "/api/chat/send" >>= OK "\"Hello World!\""
      path "/api/chat/messages" >>= OK (stubMessages |> Json.serialize |> Json.format)
      path "/api/chat/subscribe" >>= EventSource.handShake (HubAndSpoke.subscribe hub)
    ]

startWebServer suaveConfig <|
  choose [
    Chat.api
    Files.browseHome // first see if you find the file in requested
    Files.browseFileHome "index.html" // always serve index.html by default
    ServerErrors.INTERNAL_ERROR "Please place your index.html in the right folder"
  ]