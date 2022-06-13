module.exports = app => ({
  /**
   * 分页url权限列表
   * @param page
   * @param pageSize
   * @param status
   * @param searchKey
   * @returns {Promise<{total: *, list: *}>}
   */
  async getUrlPermissionList (page = 1, pageSize = 10, status, searchKey) {
    const { $utils, $log4, $model } = app
    const { errorLogger } = $log4
    const { adminUrlPermission } = $model
    let searchParams = {}
    if(searchKey && searchKey !== ''){
      let p1 = {
        "$or": [
          {
            "name": new RegExp(searchKey,'i')
          },
          {
            "key": new RegExp(searchKey,'i')
          },
        ]
      }
      let p2 = {}
      if(status !== null && status !== undefined){
        p2.status = status
      }
      searchParams = $utils.isEmptyObject(p2) ? p1 : {"$and": [p1, p2]}
    } else {
      if(status !== null && status !== undefined){
        searchParams.status = status
      }
    }
    let sortParam = {_id: -1}
    let total = await adminUrlPermission.find(searchParams).countDocuments()
    let list = await adminUrlPermission.find(searchParams, null, {skip: pageSize * (page < 1 ? 0 : (page - 1)), limit: (pageSize - 0), sort: sortParam }, function (err){
      if(err){
        console.log(err)
        errorLogger.error('【permissionService】- getUrlPermissionList:' + err.toString())
      }
    })
    return { list, total }
  },

  /**
   * 分页获取UI权限列表
   * @param page
   * @param pageSize
   * @param status
   * @param searchKey
   * @returns {Promise<{total: *, list: *}>}
   */
  async getUiPermissionList (page = 1, pageSize = 10, status, searchKey) {
    const { $utils, $log4, $model } = app
    const { errorLogger } = $log4
    const { adminUiPermission } = $model
    let searchParams = {}
    if(searchKey && searchKey !== ''){
      let p1 = {
        "$or": [
          {
            "name": new RegExp(searchKey,'i')
          },
          {
            "key": new RegExp(searchKey,'i')
          },
        ]
      }
      let p2 = {}
      if(status !== null && status !== undefined){
        p2.status = status
      }
      searchParams = $utils.isEmptyObject(p2) ? p1 : {"$and": [p1, p2]}
    } else {
      if(status !== null && status !== undefined){
        searchParams.status = status
      }
    }
    let sortParam = {
      _id: -1
    }
    let total = await adminUiPermission.find(searchParams).countDocuments()
    let list = await adminUiPermission.find(searchParams, null, {skip: pageSize * (page < 1 ? 0 : (page - 1)), limit: (pageSize - 0), sort: sortParam }, function (err){
      if(err){
        console.log(err)
        errorLogger.error('【permissionService】- getUiPermissionList:' + err.toString())      }
    })
    return { list, total }
  },
})
