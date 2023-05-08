//全局变量引入
const { DIRECT, TAGS } = require("../hook/globalParams");
const { UP, DOWN, LEFT, RIGHT } = DIRECT;
const { WALL, GRID, WATER, HOME, ANOTHREHOME } = TAGS;
//socketMessage引入
const { ServerSendMsg, DrawMsg, SyncMsg, MSG_TYPE_SERVER, OPERA_DRAW_TYPE, SYNC_SERVER_TYPE } = require("../socket/socketMessage")
/**
 * 检测2个物体是否碰撞
 * @param object1 物体1
 * @param object2 物体2
 * @param overlap 允许重叠的大小
 * @returns {Boolean} 如果碰撞了，返回true
 */
module.exports.CheckIntersect = function (object1, object2, overlap) {
	//    x-轴                      x-轴
	//  A1------>B1 C1              A2------>B2 C2
	//  +--------+   ^              +--------+   ^
	//  | object1|   | y-轴         | object2|   | y-轴
	//  |        |   |              |        |   |
	//  +--------+  D1              +--------+  D2
	//
	//overlap是重叠的区域值
	let A1 = object1.x + overlap;
	let B1 = object1.x + object1.size - overlap;
	let C1 = object1.y + overlap;
	let D1 = object1.y + object1.size - overlap;

	let A2 = object2.x + overlap;
	let B2 = object2.x + object2.size - overlap;
	let C2 = object2.y + overlap;
	let D2 = object2.y + object2.size - overlap;

	//假如他们在x-轴重叠
	if (A1 >= A2 && A1 <= B2
		|| B1 >= A2 && B1 <= B2) {
		//判断y-轴重叠
		if (C1 >= C2 && C1 <= D2 || D1 >= C2 && D1 <= D2) {
			return true;
		}
	}
	return false;
}

/**
 * 坦克与地图块碰撞
 * @param tank 坦克对象
 * @param mapobj 地图对象
 * @returns {Boolean} 如果碰撞，返回true
 */
module.exports.tankMapCollision = function (tank, gameInstance) {
	let mapobj = gameInstance.map;
	//移动检测，记录最后一次的移动方向，根据方向判断+-overlap,
	let tileNum = 0;//需要检测的tile数
	let rowIndex = 0;//map中的行索引
	let colIndex = 0;//map中的列索引
	let overlap = 3;//允许重叠的大小

	//根据tank的x、y计算出map中的row和col
	if (tank.dir == UP) {
		rowIndex = parseInt((tank.tempY + overlap - mapobj.offsetY) / mapobj.tileSize);
		colIndex = parseInt((tank.tempX + overlap - mapobj.offsetX) / mapobj.tileSize);
	} else if (tank.dir == DOWN) {
		//向下，即dir==1的时候，行索引的计算需要+tank.Height
		rowIndex = parseInt((tank.tempY - overlap - mapobj.offsetY + tank.size) / mapobj.tileSize);
		colIndex = parseInt((tank.tempX + overlap - mapobj.offsetX) / mapobj.tileSize);
	} else if (tank.dir == LEFT) {
		rowIndex = parseInt((tank.tempY + overlap - mapobj.offsetY) / mapobj.tileSize);
		colIndex = parseInt((tank.tempX + overlap - mapobj.offsetX) / mapobj.tileSize);
	} else if (tank.dir == RIGHT) {
		rowIndex = parseInt((tank.tempY + overlap - mapobj.offsetY) / mapobj.tileSize);
		//向右，即dir==3的时候，列索引的计算需要+tank.Height
		colIndex = parseInt((tank.tempX - overlap - mapobj.offsetX + tank.size) / mapobj.tileSize);
	}
	if (rowIndex >= mapobj.HTileCount || rowIndex < 0 || colIndex >= mapobj.wTileCount || colIndex < 0) {
		return true;
	}
	if (tank.dir == UP || tank.dir == DOWN) {
		let tempWidth = parseInt(tank.tempX - gameInstance.map.offsetX - (colIndex) * mapobj.tileSize + tank.size - overlap);//去除重叠部分
		if (tempWidth % mapobj.tileSize == 0) {
			tileNum = parseInt(tempWidth / mapobj.tileSize);
		} else {
			tileNum = parseInt(tempWidth / mapobj.tileSize) + 1;
		}
		for (let i = 0; i < tileNum && colIndex + i < mapobj.wTileCount; i++) {
			let mapContent = mapobj.mapLevel[rowIndex][colIndex + i];
			if (mapContent == WALL || mapContent == GRID || mapContent == WATER || mapContent == HOME || mapContent == ANOTHREHOME) {
				if (tank.dir == UP) {
					tank.y = mapobj.offsetY + rowIndex * mapobj.tileSize + mapobj.tileSize - overlap;
				} else if (tank.dir == DOWN) {
					tank.y = mapobj.offsetY + rowIndex * mapobj.tileSize - tank.size + overlap;
				}
				return true;
			}
		}
	} else {
		let tempHeight = parseInt(tank.tempY - gameInstance.map.offsetY - (rowIndex) * mapobj.tileSize + tank.size - overlap);//去除重叠部分
		if (tempHeight % mapobj.tileSize == 0) {
			tileNum = parseInt(tempHeight / mapobj.tileSize);
		} else {
			tileNum = parseInt(tempHeight / mapobj.tileSize) + 1;
		}
		for (let i = 0; i < tileNum && rowIndex + i < mapobj.HTileCount; i++) {
			let mapContent = mapobj.mapLevel[rowIndex + i][colIndex];
			if (mapContent == WALL || mapContent == GRID || mapContent == WATER || mapContent == HOME || mapContent == ANOTHREHOME) {
				if (tank.dir == LEFT) {
					tank.x = mapobj.offsetX + colIndex * mapobj.tileSize + mapobj.tileSize - overlap;
				} else if (tank.dir == RIGHT) {
					tank.x = mapobj.offsetX + colIndex * mapobj.tileSize - tank.size + overlap;
				}
				return true;
			}
		}
	}
	return false;
}

/**
 * 子弹与地图块的碰撞
 * @param bullet 子弹对象
 * @param mapobj 地图对象
 */
module.exports.bulletMapCollision = function (bullet, gameInstance, ws) {
	let mapobj = gameInstance.map;
	let tileNum = 0;//需要检测的tile数
	let rowIndex = 0;//map中的行索引
	let colIndex = 0;//map中的列索引
	let mapChangeIndex = [];//map中需要更新的索引数组
	let result = false;//是否碰撞
	//根据bullet的x、y计算出map中的row和col
	if (bullet.dir == UP) {
		rowIndex = parseInt((bullet.y - mapobj.offsetY) / mapobj.tileSize);
		colIndex = parseInt((bullet.x - mapobj.offsetX) / mapobj.tileSize);
	} else if (bullet.dir == DOWN) {
		//向下，即dir==1的时候，行索引的计算需要+bullet.Height
		rowIndex = parseInt((bullet.y - mapobj.offsetY + bullet.size) / mapobj.tileSize);
		colIndex = parseInt((bullet.x - mapobj.offsetX) / mapobj.tileSize);
	} else if (bullet.dir == LEFT) {
		rowIndex = parseInt((bullet.y - mapobj.offsetY) / mapobj.tileSize);
		colIndex = parseInt((bullet.x - mapobj.offsetX) / mapobj.tileSize);
	} else if (bullet.dir == RIGHT) {
		rowIndex = parseInt((bullet.y - mapobj.offsetY) / mapobj.tileSize);
		//向右，即dir==3的时候，列索引的计算需要+bullet.Height
		colIndex = parseInt((bullet.x - mapobj.offsetX + bullet.size) / mapobj.tileSize);
	}
	if (rowIndex >= mapobj.HTileCount || rowIndex < 0 || colIndex >= mapobj.wTileCount || colIndex < 0) {
		return true;
	}

	if (bullet.dir == UP || bullet.dir == DOWN) {
		let tempWidth = parseInt(bullet.x - gameInstance.map.offsetX - (colIndex) * mapobj.tileSize + bullet.size);
		if (tempWidth % mapobj.tileSize == 0) {
			tileNum = parseInt(tempWidth / mapobj.tileSize);
		} else {
			tileNum = parseInt(tempWidth / mapobj.tileSize) + 1;
		}
		for (let i = 0; i < tileNum && colIndex + i < mapobj.wTileCount; i++) {
			let mapContent = mapobj.mapLevel[rowIndex][colIndex + i];
			if (mapContent == WALL || mapContent == GRID || mapContent == HOME || mapContent == ANOTHREHOME) {
				//bullet.distroy();
				result = true;
				if (mapContent == WALL) {
					//墙被打掉
					mapChangeIndex.push([rowIndex, colIndex + i]);
				} else if (mapContent == GRID) {
					continue;
				} else {
					gameInstance.isGameOver = true;
					break;
				}
			}
		}
	} else {
		let tempHeight = parseInt(bullet.y - gameInstance.map.offsetY - (rowIndex) * mapobj.tileSize + bullet.size);
		if (tempHeight % mapobj.tileSize == 0) {
			tileNum = parseInt(tempHeight / mapobj.tileSize);
		} else {
			tileNum = parseInt(tempHeight / mapobj.tileSize) + 1;
		}
		for (let i = 0; i < tileNum && rowIndex + i < mapobj.HTileCount; i++) {
			let mapContent = mapobj.mapLevel[rowIndex + i][colIndex];
			if (mapContent == WALL || mapContent == GRID || mapContent == HOME || mapContent == ANOTHREHOME) {
				//bullet.distroy();
				result = true;
				if (mapContent == WALL) {
					//墙被打掉
					mapChangeIndex.push([rowIndex + i, colIndex]);
				} else if (mapContent == GRID) {
					continue;
				} else {
					gameInstance.isGameOver = true;
					break;
				}
			}
		}
	}
	//服务器更新地图
	gameInstance.map.updateMap(mapChangeIndex, 0);
	//通知客户端更新地图
	//indexArr更新的地图索引，target更新的数值
	const indexArr = mapChangeIndex, target = 0;
	ServerSendMsg(
		ws,
		MSG_TYPE_SERVER.MSG_SYNC_SERVER,
		new SyncMsg('map_update', SYNC_SERVER_TYPE.MAP_UPDATE, { indexArr, target })
	);

	return result;
}
