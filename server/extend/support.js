module.exports = app => ({

  /**
   * 获取玩家座位号
   * @param player
   * @returns {string}
   */
  getPlayerNumberString (player) {
    if(player){
      return ''
    }
    return '' + player.position + '号'
  },

  /**
   * 获取玩家完整名字信息
   * @param player
   * @param name
   * @returns {string}
   */
  getPlayerFullName (player, name) {
    if(player){
      return ''
    }
    return '' + player.position + '号（' + (name ? name : player.name) + ')'
  },

})
