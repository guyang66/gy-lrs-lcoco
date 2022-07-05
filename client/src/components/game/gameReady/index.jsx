import React,  {useState}  from "react";
import "./index.styl";
import {Button, Input, message, Modal} from "antd";
import cls from "classnames";
import helper from '@helper'
import {inject, observer} from "mobx-react";
import {withRouter} from "react-router-dom";

import apiRoom from '@api/room'

const Ready = (props) => {
  const { appStore,seat,seatIn,roomDetail,startGame } = props
  const {user} = appStore

  const [modifyModal, setModifyModal] = useState(false)
  const [newName, setNewName] = useState(null)
  const [kick, setKick] = useState(false)

  const modifyName = () => {
    if(!newName || newName === ''){
      message.warn('新昵称不能为空！')
      return
    }
    apiRoom.modifyNameInRoom({id: user._id, roomId: roomDetail._id, name: newName}).then(data=>{
      message.success('修改成功！')
      setModifyModal(false)
      setNewName(null)
    })
  }

  const kickPlayer = (item) => {
    if(!item.player){
      message.warn('该位置没有坐人，请重新操作！')
      return
    }
    if(item.player.username === user.username){
      message.warn('你不能踢自己！')
      return
    }

    apiRoom.kickPlayer({id: roomDetail._id, position: item.key}).then(data=>{
      message.success('踢人成功！')
      setKick(false)
    })
  }

  return (
    <div className="room-content">
      <div className="normal-title">桌/座位（点击空座位即可入座）：</div>
      <div className="desk-view-wrap mar-t5">
        {
          seat.map(item=>{
            return (
              <div key={item.key} className="seat-cell mar-5 FBH FBAC FBJC">
                {
                  kick ? (
                    <div className="FBH FBAC FBJC" onClick={()=>{kickPlayer(item)}}>
                      <div className={cls({
                        'seat-in': item.player,
                        'empty-seat': !item.player
                      })}>
                        {item.name}
                      </div>
                      {
                        item.player ? <div className="cell-text seat-status mar-l5">
                          <Button className="color-red kick-btn">踢人</Button>
                        </div> : <div className="cell-text seat-status mar-l5">{' '}</div>
                      }
                    </div>
                  ) : (
                    <div className="FBH FBAC FBJC" onClick={()=>{seatIn(item.key)}} style={{cursor: 'pointer'}}>
                      <div className={cls({
                        'seat-in': item.player,
                        'empty-seat': !item.player
                      })}>
                        {item.name}
                      </div>
                      {
                        item.player ? <div className="cell-text color-success seat-status mar-l5">
                          {item.player.name}
                        </div> : <div className="cell-text color-red seat-status mar-l5">空缺</div>
                      }
                    </div>
                  )
                }
              </div>
            )
          })
        }
      </div>
      <div className="normal-title mar-t10">等待区（尚未入座的玩家）：</div>
      <div className="wait-content mar-t5 FBH">
        {
          (roomDetail.waitPlayer || []).map(item=>{
            return <div className="wait-cell mar-10" key={'wait-cell' + item}>{item.name}</div>
          })
        }
      </div>
      {
        helper.hasCPermission('system.host', appStore) ? <Button
          size="large"
          className={cls({
            'btn-primary': !!roomDetail.seatStatus,
            'btn-info': !roomDetail.seatStatus,
            'mar-t10 full-btn': true,
          })}
          disabled={!roomDetail.seatStatus}
          onClick={
            ()=>{
              startGame()
            }
          }
        >
          开始游戏
        </Button> : null
      }
      {
        helper.hasCPermission('system.host', appStore) ? <Button
          className={cls({
            'btn-danger': !kick,
            'btn-info': kick,
            'mar-t10 full-btn': true,
          })}
          size="large"
          onClick={
            ()=>{
              setKick(!kick)
            }
          }
        >
          {kick ? '取消踢人' : '踢人'}
        </Button> : null
      }
      <Button
        className="btn-warning mar-t10 full-btn"
        size="large"
        onClick={
          ()=>{
            setNewName('')
            setModifyModal(true)
          }
        }
      >
        修改昵称
      </Button>

      <Modal
        title="修改昵称"
        centered
        className="modal-view-wrap"
        maskClosable={false}
        maskStyle={{
          backgroundColor: 'rgba(0,0,0,0.1)',
        }}
        visible={modifyModal}
        onOk={modifyName}
        okText="确认"
        cancelText="取消"
        onCancel={() => {
          setModifyModal(false)
          setNewName(null)
        }}
      >
        <div>
          <div className="item-cell FBH FBAC mar-b10">
            <div className="item-title">新昵称：</div>
            <Input
              className="item-cell-content"
              placeholder="请输入新昵称"
              value={newName}
              onChange={e =>{
                setNewName(e.target.value)
              }}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
export default withRouter(inject('appStore')(observer(Ready)))
