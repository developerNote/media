enum LogLevel {
    Debug,
    Info,
    Warn,
    Error
}

class Log {
    private log(tag: number, msg: string) {
        var now=new Date();
        var t=("0"+now.getMinutes()).substr(-2)
            +":"+("0"+now.getSeconds()).substr(-2)
            +"."+("00"+now.getMilliseconds()).substr(-3);
        var arr=["["+t+" media plugins]"+msg];

        for(let i = 1; i < arguments.length; i++){
            arr.push(arguments[i]);
        };

        console[LogLevel[tag]].apply(console, arr);
    }

    debug(msg: string) {
        this.log(LogLevel.Debug, msg);
    }

    info(msg: string) {
        this.log(LogLevel.Info, msg);
    }

    wran(msg: string) {
        this.log(LogLevel.Warn, msg);
    }

    error(msg: string) {
        this.log(LogLevel.Error, msg);
    }
    
}

export default new Log();