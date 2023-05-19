const WebSocket = require('ws');

const { clientMsgHandler } = require("./clientMsgHandler");
const { MSG_TYPE_CLIENT } = require('./socketMessage');
const { GAME_MODE } = require('../hook/globalParams');
class WebSocketServer extends WebSocket.Server {
    constructor() {
        super(...arguments);
        this.webSocketClient = {}//存放已连接的客户端
        // key:name;
        // value:{ isReady: false, players: [player1, player2], playerWs: [clients[name], client],curPlayerIndex: 0, partnerIndex: 1 }
        this.adventurePlayerMap = new Map();//存放双人游戏匹配到的客户端

        // // key:name;
        // // value:{ players: [player1~4], playerWs: [client1~4],curPlayerIndex: 0 }
        // this.multiplayerMap = new Map();//存放四人游戏匹配到的客户端

        //这里的loop用于循环匹配四人游戏，
        //匹配状态为ing loopid不为空，匹配成功或失败后，loopid置为null
        //key:matchCode value:{players:{p1name,p2,p3,p4},match:'success',loopid:,playerWs}
        this.multiPlayerGameMap = new Map();//存放四人游戏对局
    }

    set ws(val) {//代理当前的ws，赋值时将其初始化
        //即，将当前ws设置为val(新的一个连接ws)，并将val.t指向this(WebSocketServer)
        this._ws = val;
        val.adventureClientIsReady = false;//标识参与双人冒险的客户端是否已经准备好
        val.adventureDrawStageIsReady = false;//标识客户端stage绘制完毕
        val.multiClientIsReady = false;//标识参与双人冒险的客户端是否已经准备好
        val.multiDrawStageIsReady = false;//标识客户端stage绘制完毕

        val.isMatchAdventure = false;//已经匹配到双人游戏？
        val.isMatchMultiplayer = false;//已经匹配到多人游戏？

        val.multiplayerIndex = -1;//标识匹配到的多人游戏是哪一个玩家

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
        const ws = this.t.webSocketClient[name];
        let wslist = null;
        if (ws.gameMode == GAME_MODE.ADVENTURE_GAME) {
            wslist = this.t.adventurePlayerMap.get(name)?.playerWs;
        } else if (ws.gameMode == GAME_MODE.MULTIPLAER_GAME) {
            wslist = this.t.getMultiPlayerMatchWsListByCode(ws.matchCodes);
        }
        if (this.t.adventureStageIsAllReady(name) || this.t.multiStageIsAllReady(ws.matchCodes)) {
            clientMsgHandler(cmsg, wslist);
        } else {
            //此处无法直接通过this.webSocketClient访问是因为此时的this是ws
            clientMsgHandler(cmsg, ws);
        }
    }
    errorHandler(e) {
        this.t.removeClient(this)
        console.info('客户端出错')
    }

    closeHandler(e) {
        this.t.removeClient(this)
        console.info('客户端已断开')
    }
    //clients
    getClients() {
        return this.webSocketClient;
    }
    getClientByName(name) {
        return this.webSocketClient[name];
    }
    addClient(item) {//设备上线时添加到客户端列表
        if (this.webSocketClient[item['name']]) {
            console.log(item['name'] + '客户端已存在，连接失败')
            item.close();
            //this.webSocketClient[item['name']].close()
        }
        this.webSocketClient[item['name']] = item
        console.log(item['name'] + '客户端已添加')
    }
    //
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
    /****adventure game */
    getAdventureMap() {
        return this.adventurePlayerMap;
    }
    //adventure players
    addAdventure(player, value) {
        this.adventurePlayerMap.set(player, value);
    }
    //
    removeAdventure(name) {
        let playerObj = this.adventurePlayerMap.get(name);
        if (playerObj) {
            let { players, curPlayerIndex, partnerIndex } = playerObj
            this.adventurePlayerMap.delete(players[curPlayerIndex]);
            //更新partner
            const partnerName = players[partnerIndex];
            let partnerObj = this.adventurePlayerMap.get(partnerName);
            if (partnerObj) {
                //移除name后其pantner也对应改变
                const newVal = { players: [partnerName], curPlayerIndex: 0, partnerIndex: 0 };
                newVal.isReady = partnerObj.isReady;
                this.adventurePlayerMap.set(partnerName, newVal);
            }
        }
    }
    adventurePlayersIsAllReady(name) {
        const playerWs = this.webSocketClient[name];
        const playerObj = this.adventurePlayerMap.get(name);
        if (!playerObj) {
            return false;
        }
        const { players, partnerIndex } = playerObj;
        const partnerWs = this.webSocketClient[players[partnerIndex]];
        if (playerWs && partnerWs) {
            return playerWs.adventureClientIsReady && partnerWs.adventureClientIsReady;
        }
        return false;
    }
    adventureStageIsAllReady(name) {
        const playerWs = this.webSocketClient[name];
        const playerObj = this.adventurePlayerMap.get(name);
        if (!playerObj) {
            return false;
        }
        const { players, partnerIndex } = playerObj;
        const partnerWs = this.webSocketClient[players[partnerIndex]];
        if (playerWs && partnerWs) {
            return playerWs.adventureDrawStageIsReady && partnerWs.adventureDrawStageIsReady;
        }
        return false;
    }
    //multiplayer game
    // getMultiplayerMap() {
    //     return this.multiplayerMap;
    // }
    // getMultiplayerByName() {

    // }
    // addMultiplayer(player, value) {
    //     this.multiplayerMap.set(player, value);
    // }
    multiPlayersIsAllReady(code) {
        const playerWsListObject = this.multiPlayerGameMap.get(code).playerWs;
        const { playerNum } = this.multiPlayerGameMap.get(code);
        let result = true;
        for (let i = 1; i <= playerNum; i++) {
            if (!playerWsListObject["p" + i].multiClientIsReady) {
                result = false;
                break;
            }
        }
        return result;
    }
    multiStageIsAllReady(code) {
        const playerWsListObject = this.multiPlayerGameMap.get(code).playerWs;
        const { playerNum } = this.multiPlayerGameMap.get(code);
        let result = true;
        for (let i = 1; i <= playerNum; i++) {
            if (!playerWsListObject["p" + i].multiDrawStageIsReady) {
                result = false;
                break;
            }
        }
        return result;
    }
    //
    getMultiPlayerGameMap() {
        return this.multiPlayerGameMap;
    }
    //根据matchCode获取匹配对局
    getMultiPlayerGameByMatchCode(code) {
        return this.multiPlayerGameMap.get(code);
    }
    addMultiplayerGame(code, value) {
        this.multiPlayerGameMap.set(code, value);
    }
    //客户端是否在匹配对局中
    getMultiPlayerMatchStateByCodeAndName(code, name) {
        const matchGame = this.getMultiPlayerGameByMatchCode(code);
        if (matchGame) {
            const { p1, p2, p3, p4 } = matchGame.players;
            if (name == p1 || name == p2 || name == p3 || name == p4) {
                return true;
            }
        }
        return false;
    }
    //获取匹配到对局中的所有ws连接
    //return Array
    getMultiPlayerMatchWsListByCode(code) {
        const playerWsListObject = this.multiPlayerGameMap.get(code).playerWs;
        const { playerNum } = this.multiPlayerGameMap.get(code);
        let arr = [];
        for (let i = 1; i <= playerNum; i++) {
            arr.push(playerWsListObject["p" + i]);
        }
        return arr;
    }
}//webSocketServer

module.exports = { WebSocketServer };