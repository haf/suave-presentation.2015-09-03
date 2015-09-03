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
 1. curl http://localhost:8083/
 1. default to sending index.html, from homeFolder
 1. curl -> won't work:
 1. ensure homeFolder is absolute (security measure)
 1. curl -> works. for any string path.

Ensure we can run ReactJS+RxJS contents in browser

 1. Create webpack.config.js
 1. Create .eslintrc
 1. Create react structure with router
 1. Create first js page
 1. Ensure index.html is in build folder

Fix chat basics

 1. Create app, the two views and the components
 1. Stub GET /api/chat/messages
 1. Stub POST /api/chat/send
 1. Stub GET /api/chat/subscribe

Fix chat server proper

curl http://127.0.0.1:8083/api/chat/subscribe
curl -X POST --header "Content-Type: application/json; charset=utf-8" -d @sample2.json http://127.0.0.1:8083/api/chat/send
curl -X POST -i --header "Content-Type: application/json; charset=utf-8" -d @sample.json http://127.0.0.1:8083/api/chat/send
curl -X GET http://127.0.0.1:8083/api/chat/messages | jq .

Fix chat client

Enable deployments
