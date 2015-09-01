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
 1. in site.fsx
  1. create references and open statements
  1. create Hello World web part
  1. configure logging
 1. chmod +x site.fsx
 1. ./site.fsx
 1. curl http://localhost:8083
 1. default to sending index.html, from homeFolder
 1. curl -> won't work