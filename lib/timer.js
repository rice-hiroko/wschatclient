/**
 * timer.js 
 *
 * @author: https://github.com/iassasin/
 */

class Timer {
	constructor(cbk){
		this.started = false;
		this.timeout = 0;
		this.callback = cbk;
		this._timer = null;
	}

	start(to){
		this.timeout = to;
		if (!this.started){
			let self = this;
			this._timer = setInterval(function(){
				if (--self.timeout <= 0){
					self.stop();
					self.callback();
				}
			}, 1000);
			this.started = true;
		}
	}

	stop(){
		if (this._timer){
			clearInterval(this._timer);
			this._timer = null;
			this.started = false;
		}
	}
}

module.exports = Timer;
