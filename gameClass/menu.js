//全局变量引入
const { SCREEN, PICTURES, POS } = require("../hook/globalParams");
const { SCREEN_HEIGHT, SCREEN_WIDTH } = SCREEN;
// const { MENU_IMAGE, RESOURCE_IMAGE } = PICTURES();
//相关类引入
const { SelectTank } = require('./tank')
//服务器通信消息引入
const { ServerSendMsg, DrawMsg, OPERA_DRAW_TYPE, MSG_TYPE_SERVER } = require("../socket/socketMessage")
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
		ServerSendMsg(
			ws,
			MSG_TYPE_SERVER.MSG_OPERA_DRAW,
			new DrawMsg('menu_draw', OPERA_DRAW_TYPE.MENU_DRAW)
		);
	};

	/**
	 * 选择坦克上下移动
	 */
	this.next = function (n) {
		this.playNum += n;
		if (this.playNum > 2) {
			this.playNum = 1;
		} else if (this.playNum < 1) {
			this.playNum = 2;
		}
	};
};
module.exports = {
	Menu
}