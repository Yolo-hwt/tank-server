const {
    ServerSendMsg,
    MultiMsg,
    MSG_TYPE_SERVER,
    MULTI_SIGN_TYPE,
} = require("../socket/socketMessage");
const { GAME_MODE } = require("../hook/globalParams")
//双人游戏匹配
const matchAdventureGameByCodes = function (ws, matchTime) {
    const name = ws.name;
    const matchCodes = ws.matchCodes;
    const webSocketTemp = ws.t;
    let clients = webSocketTemp.getClients();
    let timeTemp = matchTime * 1000;
    let matchTimer = setInterval(() => {
        //连接已经主动断开
        if (ws.readyState == 2 || ws.readyState == 3) {
            console.log("客户端主动断开");
            clearInterval(matchTimer);
            return;
        }
        if (timeTemp <= 0) {
            //匹配失败
            matchAdventureFailed(webSocketTemp, matchTimer, name)
        }
        timeTemp -= 50;
        //如果adventureMap中存在当前待匹配name说明已经匹配完成
        if (webSocketTemp.getAdventureMap().has(name)) {
            //已经匹配成功
            matchAdventureSuccess(webSocketTemp, matchTimer, name);
        } else {
            //循环查找client，并匹配
            clients = webSocketTemp.getClients();
            let clientsKey = Object.keys(clients);
            for (let i = 0; i < clientsKey.length; i++) {
                const key = clientsKey[i];
                let client = clients[key];
                if (client && client.name != name) {
                    //成功匹配
                    if (client.matchCodes == matchCodes) {
                        webSocketTemp.addAdventure([name, client.name]);
                        matchAdventureSuccess(webSocketTemp, matchTimer, name);
                        break;
                    }
                }
            }
        }

    }, 50);
}
//双人游戏匹配成功
const matchAdventureSuccess = function (webSocketTemp, matchTimer, name) {
    clearInterval(matchTimer);
    let ws = webSocketTemp.getClientByName(name);
    let nameArr = webSocketTemp.getAdventureMap().get(name);
    let partner = nameArr[0] == name ? nameArr[1] : nameArr[0];
    console.log(name + "匹配双人冒险模式，true");
    //同步客户端数据
    ServerSendMsg(
        ws,
        MSG_TYPE_SERVER.MSG_MULTI_SIGN,
        new MultiMsg(
            'adventure_match_ok',
            GAME_MODE.ADVENTURE_GAME,
            MULTI_SIGN_TYPE.ADVENTURE_MATCH_OK,
            { partner }
        )
    );
    // webSocketTemp.getClientByName(name).send(JSON.stringify({ test: nameArr }))
}
//双人游戏匹配失败
const matchAdventureFailed = function (webSocketTemp, matchTimer, name) {
    console.log(name + "匹配双人冒险模式，false");
    clearInterval(matchTimer);
    let ws = webSocketTemp.getClientByName(name);
    //同步客户端数据
    ServerSendMsg(
        ws,
        MSG_TYPE_SERVER.MSG_MULTI_SIGN,
        new MultiMsg('adventure_match_no', GAME_MODE.ADVENTURE_GAME, MULTI_SIGN_TYPE.ADVENTURE_MATCH_NO)
    );
    //
}
//四人游戏匹配
const matchMultiplayerGameByCodes = function () {

}
module.exports = {
    matchAdventureGameByCodes,
    matchMultiplayerGameByCodes
}