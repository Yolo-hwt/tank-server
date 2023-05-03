const { ServerSendMsg, DrawMsg, OPERA_DRAW_TYPE, MSG_TYPE_SERVER } = require("../socket/socketMessage")

module.exports.Stage = function (gameInstance) {
	//this.ctx = gameInstance.ctx;
	//this.ctx.fillStyle = "#7f7f7f";
	this.drawHeigth = 15;
	this.level = gameInstance.level;
	this.temp = 0;
	this.dir = 1; //中间切换的方向，1：合上，2：展开
	this.isReady = false;//标识地图是否已经画好
	//this.levelNum = new Num(gameInstance.ctx);

	this.init = function (level) {
		this.dir = 1;
		this.isReady = false;
		this.level = level;
		this.temp = 0;
	};

	this.draw = function (ws, gameInstance) {
		let { level, maxEnemy } = gameInstance
		let p1Lives = gameInstance.player1.lives
		let p2lives = gameInstance.player2.lives

		ServerSendMsg(
			ws,
			MSG_TYPE_SERVER.MSG_OPERA_DRAW,
			new DrawMsg('stage_draw', OPERA_DRAW_TYPE.STAGE_DRAW, { level, maxEnemy, p1Lives, p2lives })
		);

	};
};