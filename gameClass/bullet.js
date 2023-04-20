//全局变量引入
const { POS, DIRECT, PICTURES, BULLET_TYPE, CRACK_TYPE, SOUNDS } = require("../hook/globalParams");
const { UP, DOWN, LEFT, RIGHT } = DIRECT;
const { RESOURCE_IMAGE } = PICTURES();
const { BULLET_TYPE_ENEMY, BULLET_TYPE_PLAYER } = BULLET_TYPE;
const { CRACK_TYPE_BULLET } = CRACK_TYPE;
const { BULLET_DESTROY_AUDIO } = SOUNDS;
//工具函数引入
const { CrackAnimation } = require("../utils/crackAnimation")
const { CheckIntersect, bulletMapCollision } = require("../utils/Collision")
module.exports.Bullet = function (owner, type, dir, gameInstance) {
	this.ctx = gameInstance.tankCtx;
	this.gameCtx = gameInstance;
	this.x = 0;
	this.y = 0;
	this.owner = owner; //子弹的所属者
	this.type = type;//1、玩家  2、敌方
	this.dir = dir;
	this.speed = 3;
	this.size = 6;
	this.hit = false;
	this.isDestroyed = false;

	this.draw = function () {
		this.ctx.drawImage(RESOURCE_IMAGE, POS["bullet"][0] + this.dir * this.size, POS["bullet"][1], this.size, this.size, this.x, this.y, this.size, this.size);
		// this.ctx.drawImage(RESOURCE_IMAGE, POS["bullet"][0] + this.dir * this.size, POS["bullet"][1], this.size, this.size, this.x - this.size / 2, this.y - this.size / 2, this.size * 2, this.size * 2);
		this.move();
	};

	this.move = function () {
		if (this.dir == UP) {
			this.y -= this.speed;
		} else if (this.dir == DOWN) {
			this.y += this.speed;
		} else if (this.dir == RIGHT) {
			this.x += this.speed;
		} else if (this.dir == LEFT) {
			this.x -= this.speed;
		}

		this.isHit();
	};

	/**
	 * 碰撞检测
	 */
	this.isHit = function () {
		if (this.isDestroyed) {
			return;
		}
		//临界检测
		if (this.x < this.gameCtx.map.offsetX) {
			this.x = this.gameCtx.map.offsetX;
			this.hit = true;
		} else if (this.x > this.gameCtx.map.offsetX + this.gameCtx.map.mapWidth - this.size) {
			this.x = this.gameCtx.map.offsetX + this.gameCtx.map.mapWidth - this.size;
			this.hit = true;
		}
		if (this.y < this.gameCtx.map.offsetY) {
			this.y = this.gameCtx.map.offsetY;
			this.hit = true;
		} else if (this.y > this.gameCtx.map.offsetY + this.gameCtx.map.mapHeight - this.size) {
			this.y = this.gameCtx.map.offsetY + this.gameCtx.map.mapHeight - this.size;
			this.hit = true;
		}
		//子弹是否碰撞了其他子弹
		if (!this.hit) {
			if (this.gameCtx.bulletArray != null && this.gameCtx.bulletArray.length > 0) {
				for (var i = 0; i < this.gameCtx.bulletArray.length; i++) {
					if (this.gameCtx.bulletArray[i] != this && this.owner.isAI != this.gameCtx.bulletArray[i].owner.isAI && this.gameCtx.bulletArray[i].hit == false && CheckIntersect(this.gameCtx.bulletArray[i], this, 0)) {
						this.hit = true;
						this.gameCtx.bulletArray[i].hit = true;
						break;
					}
				}
			}
		}

		if (!this.hit) {
			//地图检测
			if (bulletMapCollision(this, this.gameCtx)) {
				this.hit = true;
			}
			//是否击中坦克
			if (this.type == BULLET_TYPE_PLAYER) {
				if (this.gameCtx.enemyArray != null || this.gameCtx.enemyArray.length > 0) {
					for (let i = 0; i < this.gameCtx.enemyArray.length; i++) {
						var enemyObj = this.gameCtx.enemyArray[i];
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
				if (this.gameCtx.player1.lives > 0 && CheckIntersect(this, this.gameCtx.player1, 0)) {
					if (!this.gameCtx.player1.isProtected && !this.gameCtx.player1.isDestroyed) {
						this.gameCtx.player1.distroy();
					}
					this.hit = true;
				} else if (this.gameCtx.player2.lives > 0 && CheckIntersect(this, this.gameCtx.player2, 0)) {
					if (!this.gameCtx.player2.isProtected && !this.gameCtx.player2.isDestroyed) {
						this.gameCtx.player2.distroy();
					}
					this.hit = true;
				}
			}
		}


		if (this.hit) {
			this.distroy();
		}
	};

	/**
	 * 销毁
	 */
	this.distroy = function () {
		this.isDestroyed = true;
		this.gameCtx.crackArray.push(new CrackAnimation(CRACK_TYPE_BULLET, this.ctx, this));
		if (!this.owner.isAI) {
			BULLET_DESTROY_AUDIO.play();
		}
	};


};