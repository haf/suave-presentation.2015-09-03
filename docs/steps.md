# Steps

 1. add paket.bootstrapper.exe
 1. mono paket.bootstrapper.exe
 1. echo paket.exe >>.gitignore
 1. 'public' dir for js
 1. add package.json in 'public'
 1. npm install
 1. echo node_modules/ >>../.gitignore
 1. create index.html

Ensure we can serve index.html

 1. add Suave, FSharp.Core, Logary.Adapters.Suave to paket.dependencies
 1. paket install
 1. echo packages/ >>.gitignore
