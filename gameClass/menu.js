//全局变量引入
const { SCREEN, STATE } = require("../hook/globalParams");
const { SCREEN_HEIGHT, SCREEN_WIDTH } = SCREEN;
//相关类引入
const { SelectTank } = require('./tank')
//服务器通信消息引入
const {
	ServerSendMsg,
	SyncMsg, DrawMsg,
	MSG_TYPE_SERVER,
	SYNC_SERVER_TYPE
} = require("../socket/socketMessage")
/**
 * 游戏开始菜单
 **/
var Menu = function () {
	//this.ctx = gameInstance.ctx;
	this.x = 0;
	this.y = SCREEN_HEIGHT;
	this.selectTank = new SelectTank();
	this.playNum = 1;
	this.times = 0;

	/**
	 * 画菜单
	 */
	this.draw = function (ws) {
		//通知客户端修改游戏状态为GAME_STATE_MENU
		ServerSendMsg(
			ws,
			MSG_TYPE_SERVER.MSG_SYNC_SERVER,
			new SyncMsg('game_state', SYNC_SERVER_TYPE.BASIC_DATA_SERVER, { level: 1, target: ["gameState"], value: STATE.GAME_STATE_MENU })
		);
	};

	/**
	 * 选择坦克上下移动
	 */
	this.next = function (ws, n) {
		this.playNum += n;
		if (this.playNum > 2) {
			this.playNum = 1;
		} else if (this.playNum < 1) {
			this.playNum = 2;
		}
		const playNum = this.playNum;
		ServerSendMsg(
			ws,
			MSG_TYPE_SERVER.MSG_SYNC_SERVER,
			new SyncMsg('menu_playNum', SYNC_SERVER_TYPE.BASIC_DATA_SERVER, { level: 2, target: ["menu", "playNum"], value: playNum })
		);
	};
};
module.exports = {
	Menu
}