module.exports = app => ({

  /**
   * 查询在座位上的玩家
   * @returns {Promise<void>}
   */
  async findInSeatPlayer (roomId, username = '') {
    const { $service, $helper, $model } = app
    const { room } = $model
    if(!roomId){
      return $helper.wrapResult(false, '房间id不存在！', -1)
    }
    let q = {
      "$and":
        [
          {_id: roomId},
          {
            "$or": [
              {"v1": username},
              {"v2": username},
              {"v3": username},
              {"v4": username},
              {"v5": username},
              {"v6": username},
              {"v7": username},
              {"v8": username},
              {"v9": username}
            ]
          }
        ]
    }
    let r = await $service.baseService.queryOne(room, q)
    if(r){
      return $helper.wrapResult(true, 'ok')
    } else {
      return $helper.wrapResult(false, '玩家未入座该房间', -1)
    }
  },

  /**
   * 获取座位上的玩家信息
   * @param roomId
   * @param showPlayerInfo 是否显示玩家信息
   * @returns {Promise<null|[]>}
   */
  async getRoomSeatPlayer (roomId, showPlayerInfo = false) {
    const { $service, $helper, $model } = app
    const { user, room } = $model
    if(!roomId){
      return $helper.wrapResult(false, 'roomId为空！', -1)
    }
    let roomInstance = await $service.baseService.queryById(room, roomId)
    if(!roomInstance){
      return $helper.wrapResult(false, '房间不存在！', -1)
    }
    let count = roomInstance.count || 9
    let list = []
    for(let i = 0; i < count; i++){
      let columnKey = 'v' + (i + 1)
      let username = roomInstance[columnKey]
      if(!username){
        list.push({player: null, position: i + 1, name: (i + 1) + '号'})
        continue
      }
      let userInfo = await $service.baseService.queryOne(user, {username: username}, {username: 1, name: 1})
      if(userInfo){
        list.push({player: userInfo, position: i + 1, name: (i + 1) + '号'})
      } else {
        list.push({player: null, position: i + 1, name: (i + 1) + '号'})
      }
    }
    return $helper.wrapResult(true, list)
  },

  async isOb (roomId, username) {
    const { $service, $helper, $model } = app
    const { room} = $model
    if(!roomId || !username){
      return $helper.wrapResult(true, 'N')
    }
    let roomInstance = await $service.baseService.queryById(room, roomId)
    if(!roomInstance){
      return $helper.wrapResult(true, 'N')
    }
    let obList = roomInstance ? roomInstance.ob : []
    if(obList.includes(username)){
      return $helper.wrapResult(true, 'Y')
    }
    return $helper.wrapResult(true, 'N')
  }

})
