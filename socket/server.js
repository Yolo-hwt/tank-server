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
const { STATE, GAME_MODE } = require("../hook/globalParams")
//多人游戏匹配方法引入
const {
    matchAdventureGameByCodes,
    matchMultiplayerGameByCodes
} = require("../hook/multiplayerGameLogic")
//静态参数
const port = 1024//端口
const pathname = '/ws/'//访问路径
const matchTime = 15;
const server = http.createServer()
const webSocketServer = new WebSocketServer({ noServer: true })


//通过http.server监听upgrade事件配合URL类过滤数据
server.on("upgrade", (req, socket, head) => {
    let url = new URL(req.url, `http://${req.headers.host}`)
    let name = url.searchParams.get('name')//获取连接标识
    let mode = url.searchParams.get('mode')//获取游戏模式
    let code = url.searchParams.get('code')//获取房间匹配字符串
    if (!checkUrl(url.pathname, pathname)) {//未按标准
        socket.write('conect error:client url formatting error', url);
        socket.destroy();
        return;
    }
    //
    webSocketServer.handleUpgrade(req, socket, head, function (ws) {
        //客户端name和matchCodes
        ws.name = name;
        ws.matchCodes = code;
        webSocketServer.addClient(ws);
        //设置socket，代理ws
        webSocketServer.ws = ws
        switch (mode) {
            case GAME_MODE.ADVENTURE_GAME: {
                matchAdventureGameByCodes(ws, matchTime);
                break;
            }
            case GAME_MODE.MULTIPLAER_GAME: {
                matchMultiplayerGameByCodes()
                break;
            }
            default:
                break;
        }

        // //每个连接客户端对应的游戏实体类
        // ws.gameInstance = new GameInstance(name);
        // initObject(ws.gameInstance);
        // //开启游戏循环
        // ws.gameLoopId = setInterval(() => {
        //     gameLoop(ws)
        // }, 20);
        //console.log(ws);
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