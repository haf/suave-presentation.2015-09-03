#!/usr/bin/env fsharpi
// for Suave
#r "packages/Suave/lib/net40/Suave.dll"

// for Logary (v3.x)
#I "packages/Newtonsoft.Json/lib/net45/"
#I "packages/FSharp.Actor-logary/lib/net40/"
#I "packages/NodaTime/lib/net35-client/"
#r "packages/NodaTime/lib/net35-client/NodaTime.dll"
#r "packages/Logary/lib/net40/Logary.dll"
#r "packages/Logary.Adapters.Suave/lib/net40/Logary.Adapters.Suave.dll"

open Suave
open Suave.Types
open Suave.Web
open Suave.Http
open Suave.Http.Applicatives
open Suave.Http.Successful
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
      homeFolder = Some "public/" }

startWebServer suaveConfig <|
  choose [
    path "/hello" >>= OK "Hello World!"
    Files.browseHome // first see if you find the file in requested
    Files.browseFileHome "index.html" // always serve index.html by default
    ServerErrors.INTERNAL_ERROR "Please place your index.html in the right folder"
  ]