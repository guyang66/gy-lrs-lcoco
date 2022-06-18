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
  }
})
