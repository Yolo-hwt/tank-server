//模块引入
const http = require('http');
//js引入
require("../utils/Helper")
//类引入
const { WebSocketServer } = require("./webSocketServer")
const { GameInstance } = require("../gameClass/instance");
//游戏循环方法引入
const { gameLoop, initObject } = require("../hook/gameLogic")
//socketMessage
//全局变量引入
const { STATE } = require("../hook/globalParams")
//静态参数
const port = 1024//端口
const pathname = '/ws/'//访问路径
const server = http.createServer()
const webSocketServer = new WebSocketServer({ noServer: true })

//通过http.server监听upgrade事件配合URL类过滤数据
server.on("upgrade", (req, socket, head) => {
    let url = new URL(req.url, `http://${req.headers.host}`)
    let name = url.searchParams.get('name')//获取连接标识
    if (!checkUrl(url.pathname, pathname)) {//未按标准
        socket.write('conect error:client url formatting error', url);
        socket.destroy();
        return;
    }
    //
    webSocketServer.handleUpgrade(req, socket, head, function (ws) {
        //console.log("ws", ws);
        //客户端name
        ws.name = name;
        //每个连接客户端对应的游戏实体类
        ws.gameInstance = new GameInstance(name);
        initObject(ws.gameInstance);
        //开启游戏循环
        ws.gameLoopId = setInterval(() => {
            gameLoop(ws)
        }, 20);
        //console.log(ws);
        webSocketServer.addClient(ws);
        //设置socket
        webSocketServer.ws = ws
    });
})

//服务器启动
server.listen(port, () => {
    console.log('tank-server start watting for connect...')
})

//验证url标准
function checkUrl(url, key) {//判断url是否包含key
    return - ~url.indexOf(key)
}