const {randomUUID}=require('node:crypto');
class FarewellHost{
  constructor({present,finish,timeout=15000}){Object.assign(this,{present,finish,timeout});this.operation=null;this.completed=false;}
  request(owner){
    if(this.operation||this.completed)return;
    const operation={owner,token:randomUUID()};this.operation=operation;
    this.timer=setTimeout(()=>this.complete('timeout'),this.timeout);
    Promise.resolve().then(()=>this.present(operation)).catch(()=>this.complete('unavailable'));
  }
  done(owner,token){if(this.completed||!this.operation||this.operation.owner!==owner||this.operation.token!==token)return false;this.complete('presented');return true;}
  complete(reason){if(this.completed||!this.operation)return;this.completed=true;clearTimeout(this.timer);this.reason=reason;this.finish(reason);}
}
module.exports={FarewellHost};
