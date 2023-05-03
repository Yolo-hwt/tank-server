//全局变量引入
const { POS, DIRECT, PICTURES, BULLET_TYPE, CRACK_TYPE, SOUNDS } = require("../hook/globalParams");
const { UP, DOWN, LEFT, RIGHT } = DIRECT;
// const { RESOURCE_IMAGE } = PICTURES();
const { BULLET_TYPE_ENEMY, BULLET_TYPE_PLAYER } = BULLET_TYPE;
const { CRACK_TYPE_BULLET } = CRACK_TYPE;
const { BULLET_DESTROY_AUDIO } = SOUNDS;
//工具函数引入
const { CrackAnimation } = require("../utils/crackAnimation")
const { CheckIntersect, bulletMapCollision } = require("../utils/Collision")
//socketMessage引入
const {
	ServerSendMsg, SyncMsg, DrawMsg,
	MSG_TYPE_SERVER,
	SYNC_SERVER_TYPE,
	OPERA_DRAW_TYPE
} = require("../socket/socketMessage")
//gameLogic方法引入
const { controlAudioPlay } = require("../hook/gameLogic")
const Bullet = function (owner, type, dir) {

	this.x = 0;
	this.y = 0;
	this.owner = owner; //子弹的所属者
	this.type = type;//1、玩家  2、敌方
	this.dir = dir;
	this.speed = 3;
	this.size = 6;
	this.hit = false;
	this.isDestroyed = false;
	this.bulletIndex = -1;

	//根据子弹数组中的index通知客户端绘制
	this.draw = function (ws, gameInstance, bulletIndex) {
		this.bulletIndex = bulletIndex;
		//通知客户端绘制子弹
		//this.ctx.drawImage(RESOURCE_IMAGE, POS["bullet"][0] + this.dir * this.size, POS["bullet"][1], this.size, this.size, this.x, this.y, this.size, this.size);
		const { dir, x, y } = this;
		let refers = { dir, x, y, bulletIndex };
		ServerSendMsg(
			ws,
			MSG_TYPE_SERVER.MSG_OPERA_DRAW,
			new DrawMsg('bullet_draw', OPERA_DRAW_TYPE.BULLET_DRAW, refers)
		);

		this.move(gameInstance, ws, bulletIndex);
	};

	this.move = function (gameInstance, ws, bulletIndex) {
		if (this.dir == UP) {
			this.y -= this.speed;
		} else if (this.dir == DOWN) {
			this.y += this.speed;
		} else if (this.dir == RIGHT) {
			this.x += this.speed;
		} else if (this.dir == LEFT) {
			this.x -= this.speed;
		}

		this.isHit(gameInstance, ws, bulletIndex);
	};

	/**
	 * 碰撞检测
	 */
	this.isHit = function (gameInstance, ws, bulletIndex) {
		if (this.isDestroyed) {
			return;
		}
		//临界检测
		if (this.x < gameInstance.map.offsetX) {
			this.x = gameInstance.map.offsetX;
			this.hit = true;
		} else if (this.x > gameInstance.map.offsetX + gameInstance.map.mapWidth - this.size) {
			this.x = gameInstance.map.offsetX + gameInstance.map.mapWidth - this.size;
			this.hit = true;
		}
		if (this.y < gameInstance.map.offsetY) {
			this.y = gameInstance.map.offsetY;
			this.hit = true;
		} else if (this.y > gameInstance.map.offsetY + gameInstance.map.mapHeight - this.size) {
			this.y = gameInstance.map.offsetY + gameInstance.map.mapHeight - this.size;
			this.hit = true;
		}
		//子弹是否碰撞了其他子弹
		if (!this.hit) {
			if (gameInstance.bulletArray != null && gameInstance.bulletArray.length > 0) {
				for (var i = 0; i < gameInstance.bulletArray.length; i++) {
					if (gameInstance.bulletArray[i] != this && this.owner.isAI != gameInstance.bulletArray[i].owner.isAI && gameInstance.bulletArray[i].hit == false && CheckIntersect(gameInstance.bulletArray[i], this, 0)) {
						this.hit = true;
						gameInstance.bulletArray[i].hit = true;
						break;
					}
				}
			}
		}

		if (!this.hit) {
			//地图检测
			if (bulletMapCollision(this, gameInstance, ws)) {
				this.hit = true;
			}
			//是否击中坦克
			if (this.type == BULLET_TYPE_PLAYER) {
				if (gameInstance.enemyArray != null || gameInstance.enemyArray.length > 0) {
					for (let i = 0; i < gameInstance.enemyArray.length; i++) {
						var enemyObj = gameInstance.enemyArray[i];
						if (!enemyObj.isDestroyed && CheckIntersect(this, enemyObj, 0)) {
							CheckIntersect(this, enemyObj, 0);
							if (enemyObj.lives > 1) {
								enemyObj.lives--;
							} else {
								enemyObj.distroy();
							}
							this.hit = true;
							break;
						}
					}
				}
			} else if (this.type == BULLET_TYPE_ENEMY) {
				if (gameInstance.player1.lives > 0 && CheckIntersect(this, gameInstance.player1, 0)) {
					if (!gameInstance.player1.isProtected && !gameInstance.player1.isDestroyed) {
						gameInstance.player1.distroy();
					}
					this.hit = true;
				} else if (gameInstance.player2.lives > 0 && CheckIntersect(this, gameInstance.player2, 0)) {
					if (!gameInstance.player2.isProtected && !gameInstance.player2.isDestroyed) {
						gameInstance.player2.distroy();
					}
					this.hit = true;
				}
			}
		}


		if (this.hit) {
			this.distroy(bulletIndex);
		}
	};

	/**
	 * 销毁
	 */
	this.distroy = function (gameInstance, bulletIndex) {
		this.isDestroyed = true;
		const crackType = CRACK_TYPE.CRACK_TYPE_BULLET;
		gameInstance.crackArray.push(new CrackAnimation(crackType, this));
		//同步客户端
		ServerSendMsg(
			ws,
			MSG_TYPE_SERVER.MSG_SYNC_SERVER,
			new SyncMsg('add_crack_bullet', SYNC_SERVER_TYPE.CRACK_ADD, { crackType, bulletIndex })
		);
		if (!this.owner.isAI) {
			//
			//BULLET_DESTROY_AUDIO.play();
			//客户端播放子弹销毁音频
			controlAudioPlay(ws, 'bulletdestroy_audio', OPERA_AUDIO_TYPE.AUDIO_BULLET_DESTORY, OPERA_AUDIO_TYPE.AUDIO_PLAY)
		}
	};


};
module.exports = {
	Bullet
}