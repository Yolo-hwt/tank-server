//全局变量引入
const { POS, PICTURES, SOUNDS, TAGS } = require("../hook/globalParams");
const { CheckIntersect } = require("@/utils/Collision");
const { RESOURCE_IMAGE } = PICTURES();
const { PROP_AUDIO } = SOUNDS
const { GRID } = TAGS

module.exports.Prop = function (gameInstance) {
	this.x = 0;
	this.y = 0;
	this.duration = 600;
	this.type = 0;
	this.hit = false;
	this.width = 30;
	this.height = 28;
	this.ctx = gameInstance.overCtx;
	this.isDestroyed = false;
	this.size = 28;

	this.init = function () {
		this.ctx.clearRect(this.x, this.y, this.width, this.height);
		this.duration = 600;
		this.type = parseInt(Math.random() * 6);
		this.x = parseInt(Math.random() * 384) + gameInstance.map.offsetX;
		this.y = parseInt(Math.random() * 384) + gameInstance.map.offsetY;
		this.isDestroyed = false;
	};

	this.draw = function () {
		if (this.duration > 0 && !this.isDestroyed) {
			this.ctx.drawImage(RESOURCE_IMAGE, POS["prop"][0] + this.type * this.width, POS["prop"][1], this.width, this.height, this.x, this.y, this.width, this.height);
			this.duration--;
			this.isHit();
		} else {
			this.ctx.clearRect(this.x, this.y, this.width, this.height);
			this.isDestroyed = true;
		}
	};

	this.isHit = function () {
		var player = null;
		if (gameInstance.player1.lives > 0 && CheckIntersect(this, gameInstance.player1, 0)) {
			this.hit = true;
			player = gameInstance.player1;
		} else if (gameInstance.player2.lives > 0 && CheckIntersect(this, gameInstance.player2, 0)) {
			this.hit = true;
			player = gameInstance.player2;
		}
		if (this.hit) {
			PROP_AUDIO.play();
			this.isDestroyed = true;
			this.ctx.clearRect(this.x, this.y, this.width, this.height);
			switch (this.type) {
				case 0:
					player.lives++;
					break;
				case 1:
					gameInstance.emenyStopTime = 500;
					break;
				case 2:
					var mapChangeIndex = [[23, 11], [23, 12], [23, 13], [23, 14], [24, 11], [24, 14], [25, 11], [25, 14]];
					gameInstance.map.updateMap(mapChangeIndex, GRID);
					gameInstance.homeProtectedTime = 500;
					break;
				case 3:
					if (gameInstance.enemyArray != null || gameInstance.enemyArray.length > 0) {
						for (var i = 0; i < gameInstance.enemyArray.length; i++) {
							var enemyObj = gameInstance.enemyArray[i];
							enemyObj.distroy();
						}
					}
					break;
				case 4:
					break;
				case 5:
					player.isProtected = true;
					player.protectedTime = 500;
					break;

			}
		}


	};
};