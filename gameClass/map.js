const MAPLEVELS = require("../hook/level");
module.exports.Map = function () {
	this.level = 1;
	this.mapLevel = null;
	this.offsetX = 32; //主游戏区的X偏移量
	this.offsetY = 16;//主游戏区的Y偏移量
	this.wTileCount = 26; //主游戏区的宽度地图块数
	this.HTileCount = 26;//主游戏区的高度地图块数
	this.tileSize = 16;	//地图块的大小
	this.homeSize = 32; //家图标的大小
	//this.num = new Num(this.wallCtx);
	this.mapWidth = 416;
	this.mapHeight = 416;

	//设置地图关卡
	this.setMapLevel = function (level) {
		this.level = level;
		var tempMap = MAPLEVELS['map' + this.level];
		this.mapLevel = new Array();
		for (var i = 0; i < tempMap.length; i++) {
			this.mapLevel[i] = new Array();
			for (var j = 0; j < tempMap[i].length; j++) {
				this.mapLevel[i][j] = tempMap[i][j];
			}

		}
	};
	this.setMultiMapLevel = function (level) {
		//兼容性判断，是否有提供更新本地数据的服务器数据
		this.level = level ?? gameInstance.level;

		var tempMap = MAPLEVELS['map' + this.level];
		this.mapLevel = new Array();

		for (var i = 0; i < tempMap.length; i++) {
			this.mapLevel[i] = new Array();
			for (var j = 0; j < tempMap[i].length; j++) {
				this.mapLevel[i][j] = tempMap[i][j];
			}
		}
		//清除四个角落的障碍物//其中上侧的障碍物在设计之初就已经是清除的，为了满足ai坦克重生点
		const mapHeight = tempMap.length;
		const mapWidth = tempMap[0].length;
		//左右两个底角
		//左下角
		this.mapLevel[mapHeight - 1 - 1][0] = 0;
		this.mapLevel[mapHeight - 1 - 1][1] = 0;
		this.mapLevel[mapHeight - 1][0] = 0;
		this.mapLevel[mapHeight - 1][1] = 0;
		//右下角
		this.mapLevel[mapHeight - 1 - 1][mapWidth - 1 - 1] = 0;
		this.mapLevel[mapHeight - 1 - 1][mapWidth - 1] = 0;
		this.mapLevel[mapHeight - 1][mapWidth - 1 - 1] = 0;
		this.mapLevel[mapHeight - 1][mapWidth - 1] = 0;
	}
	/**
	 * 更新地图
	 * @param indexArr 需要更新的地图索引数组，二维数组，如[[1,1],[2,2]]
	 * @param target 更新之后的数值
	 */
	this.updateMap = function (indexArr, target) {
		if (indexArr != null && indexArr.length > 0) {
			let indexSize = indexArr.length;
			for (let i = 0; i < indexSize; i++) {
				var index = indexArr[i];
				this.mapLevel[index[0]][index[1]] = target;
			}
		}
	};
};