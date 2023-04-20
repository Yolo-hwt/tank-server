const WebSocket = require('ws');

const { clientMsgHandler } = require("./clientMsgHandler")
class WebSocketServer extends WebSocket.Server {
    constructor() {
        super(...arguments);
        this.webSocketClient = {}//存放已连接的客户端
    }

    set ws(val) {//代理当前的ws，赋值时将其初始化
        this._ws = val
        val.t = this;
        val.on('error', this.errorHandler)
        val.on('close', this.closeHandler)
        val.on('message', this.messageHandler)
    }

    get ws() {
        return this._ws
    }
    sendMsg(obj) {
        this.t.send(JSON.stringify(obj))
    }
    getMsg(e) {
        //console.log(e);
        return JSON.parse(e);
    }

    messageHandler(e) {
        const cmsg = this.t.getMsg(e);
        // console.log(cmsg);
        const name = cmsg.name ?? "";
        clientMsgHandler(cmsg, this.t.webSocketClient[name]);
    }

    errorHandler(e) {
        this.t.removeClient(this)
        console.info('客户端出错')
    }

    closeHandler(e) {
        this.t.removeClient(this)
        console.info('客户端已断开')
    }

    addClient(item) {//设备上线时添加到客户端列表
        if (this.webSocketClient[item['name']]) {
            console.log(item['name'] + '客户端已存在')
            //this.webSocketClient[item['name']].close()
        }
        this.webSocketClient[item['name']] = item
        console.log(item['name'] + '客户端已添加')
    }

    removeClient(item) {//设备断线时从客户端列表删除
        if (!this.webSocketClient[item['name']]) {
            console.log(item['name'] + '客户端不存在')
            return;
        }
        //移除客户端时候，清除游戏循环计时器
        const clearid = this.webSocketClient[item['name']].gameLoopId
        clearInterval(clearid);

        this.webSocketClient[item['name']] = null
        console.log(item['name'] + '客户端已移除')
    }
}//webSocketServer

module.exports = { WebSocketServer };