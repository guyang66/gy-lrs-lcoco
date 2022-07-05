import React from "react";
import "./index.styl";
import helper from '@helper'
import {Button} from "antd";
import {inject, observer} from "mobx-react";
import {withRouter} from "react-router-dom";

const Head = (props) => {
  const { appStore, roomDetail, gameDetail, gameDestroy } = props
  return (
    <div className="game-header-wrap">
      <div className="FBH FBAC FBJC">
        <span className="room-title">房间名：</span>
        <span className="room-title welcome-user color-orange">{roomDetail.name}（{roomDetail.password}）</span>
      </div>
      {
        helper.hasCPermission('system.host', appStore) && gameDetail.status === 1 ? (
          <Button
            onClick={gameDestroy}
            className="btn-danger game-over">
            结束游戏
          </Button>
        ) : null
      }
    </div>
  )
}

export default withRouter(inject('appStore')(observer(Head)))
