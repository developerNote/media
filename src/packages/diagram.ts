interface DiagramOptions {
    scale?: number;
    fps?: number;
    duration?: number;
    direction?: number;
    position?: number;
    centerHeight?: number;
    linear?: Array<[number, string]>;
    centerColor?: string;
    width?: number;
    height?: number;
}


export default class DefaultDiagram {

    private wrapElement?: HTMLElement;

    private canvasPerload?: HTMLCanvasElement;

    private canvasContext?: CanvasRenderingContext2D;

    private canvasPerloadContext?: CanvasRenderingContext2D;

    private drawRefreshTimer?: any;

    private offsetX: number = 0;

    private arrayBufferOffset: number = 0;

    private recentInputTime: number = Date.now();

    private pcmData?: Int8Array;

    private sampleRate: number = 16000;

    private options: DiagramOptions = {
        scale: 2, //缩放系数，应为正整数，使用2倍宽高进行绘制，避免移动端绘制模糊
        fps: 50, //绘制帧率，不可过高，50-60fps运动性质动画明显会流畅舒适，实际显示帧率达不到这个值也并无太大影响
        duration: 2500, //当前视图窗口内最大绘制的波形的持续时间，此处决定了移动速率
        direction: 1, //波形前进方向，取值：1由左往右，-1由右往左
        position: 0, //绘制位置，取值-1到1，-1为最底下，0为中间，1为最顶上，小数为百分比
        centerHeight: 1, //中线基础粗细，如果为0不绘制中线，position=±1时应当设为0
        linear: [[0, "rgba(0,187,17,1)"],[0.7, "rgba(255,215,0,1)"], [1, "rgba(255,102,0,1)"]], //波形颜色配置：[位置，css颜色，...] 位置: 取值0.0-1.0之间
        centerColor: "rgba(0,187,17,1)" //中线css颜色，留空取波形第一个渐变颜色
    };

    constructor(element: string | HTMLElement, options?: DiagramOptions) {
        this.options = { ...this.options, ...options };
        this.initElement(element);
    }

    private initElement(element: string | HTMLElement) {
        if(typeof element === 'string'){
            if(!document.querySelector(element)) throw new Error(`element ${element} not found`);
            this.wrapElement = <HTMLElement> document.querySelector(element);
        }else{
            this.wrapElement = <HTMLElement> element;
        }

        this.wrapElement.innerHTML = '';

        this.render();
    }

    private render() {
        const { scale = 2 } = this.options, 
              width = this.options.width = (<HTMLElement> this.wrapElement).offsetWidth, 
              height = this.options.height = (<HTMLElement> this.wrapElement).offsetHeight,
              transform = this.transformStyle(scale);
        let innerElement = document.createElement('div'),
            canvasWrap = document.createElement('div'),
            canvas = document.createElement("canvas");

        innerElement.style.width = width + 'px';
        innerElement.style.height =  height + 'px';
        innerElement.style.overflow = 'hidden';

        canvas.width = width;
        canvas.height = height;

        this.canvasContext = <CanvasRenderingContext2D> canvas.getContext("2d");

        this.canvasPerload = document.createElement("canvas");
        this.canvasPerloadContext = <CanvasRenderingContext2D> this.canvasPerload.getContext('2d');
        this.canvasPerload.width = width * 2; //卷轴，后台绘制画布能容纳两块窗口内容，进行无缝滚动
        this.canvasPerload.height = height;

        canvasWrap.appendChild(canvas);
        innerElement.appendChild(canvasWrap);
        (<HTMLElement> this.wrapElement).appendChild(innerElement);

    }

    private transformStyle(scale: number) {
        const transformOrigin = "transform-origin: 0 0;", transform = `transform: scale("${ 1 / scale }");`;
        const compat = ["-webkit-", "-ms-", "-moz-", ""];

        compat.map((prefix) => prefix + transformOrigin + prefix + transform);

        return compat.join('');
    }


    private originPointCalc() {
        const position = <number> this.options.position, //1 原点在上侧 | 0 原点居中 | -1 原点在下侧
              positonAbs = Math.abs(position),
              height = <number> this.options.height;
        
        if(positonAbs < 1) return Math.floor(height / 2 * ( 1 - position ))

        return position >= 1 ? 0 : height;

    }

    private draw(pcmData: Int8Array, sampleRate: number) {
        let scale = <number> this.options.scale,
            duration = <number> this.options.duration,
            direction = <number> this.options.direction,
            width =  <number> this.options.width *  <number> scale,
            height =  <number> this.options.height * <number> scale,
            lineWidth = <number> scale, //一条线占用1个单位长度
            origin = this.originPointCalc();

        //计算绘制占用长度
        let pcmWidth = (pcmData.length * 1000 * width) / (sampleRate * duration ), pointCount = 0;
        pcmWidth > lineWidth && (pointCount = Math.floor( pcmWidth / lineWidth ));

        let step = pcmData.length / pointCount;
        
		for(let i = 0, index = 0; i < pointCount; i++){

			let j = Math.floor(index), end = Math.floor(index + step);
			index += step;
			
			//寻找区间内最大值
			var maxData = 0;
			for(; j < end; j++){
				maxData = Math.max(maxData, Math.abs(pcmData[j]));
            };

            this.drawLine(<CanvasRenderingContext2D> this.canvasPerloadContext, origin, maxData, lineWidth);
        }

        //切换回当前画布
        const ctx = <CanvasRenderingContext2D> this.canvasContext;
        ctx.clearRect( 0, 0, width, height );

        //绘制中线
        this.drawDivide(ctx, origin, width);

        //画回画布
		var srcX = 0, srcW = this.offsetX, destX = 0;
		if(srcW > width){
			srcX = srcW - width;
			srcW = width;
		}else{
			destX = width - srcW;
		};
        
        if(direction == -1){ //由右往左
			ctx.drawImage((<HTMLCanvasElement> this.canvasPerload), srcX,0, srcW, height, destX, 0, srcW, height);
		}else{               //由左往右
			ctx.save();
            ctx.scale(-1,1);
			ctx.drawImage((<HTMLCanvasElement> this.canvasPerload), srcX,0, srcW, height, -width+destX, 0, srcW, height);
			ctx.restore();
		};
        
    }

    private drawDivide(ctx: CanvasRenderingContext2D, origin: number, width: number) {
        
        let centerHeight = <number> this.options.centerHeight, y = origin - Math.floor( centerHeight / 2 );

        y = Math.max(y, 0);
        y = Math.min(y, <number> this.options.height - centerHeight);
        
        ctx.fillStyle= this.options.centerColor || 'rgba(0, 0, 0, 1)';
        ctx.fillRect(0, y, width, centerHeight);
    }

    private drawLine(ctx: CanvasRenderingContext2D, origin: number, maxHeight: number, lineWidth: number) {
        const position = <number> this.options.position,
              height = <number> this.options.height,
              width =  <number> this.options.width *  <number> this.options.scale,
              heightRange = position > 1 ? height : Math.floor(height / 2 * ( 1 + Math.abs(position) ));
        
        let offsetX = this.offsetX;

        var h = heightRange * Math.min(1 , maxHeight / 0x7fff);              //计算高度

        //绘制上半部分线条
        if(origin != 0){
            ctx.fillStyle = this.genLinear(ctx, origin, origin - heightRange );
            ctx.fillRect(offsetX, origin - h, lineWidth, h);
        };

        //绘制下半部分线条
        if(origin != height){
            ctx.fillStyle = this.genLinear(ctx, origin, origin + heightRange );
            ctx.fillRect(offsetX, origin, lineWidth, h);
        };

        offsetX += lineWidth;

        //超过卷轴宽度，移动画布第二个窗口内容到第一个窗口
        if(offsetX >= width * 2){
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage((<HTMLCanvasElement> this.canvasPerload), width, 0, width, height, 0, 0, width, height);
            ctx.clearRect(width, 0, width, height);
            offsetX = width;
        };

        this.offsetX = offsetX;
    }

    private genLinear(ctx: CanvasRenderingContext2D, from: number, to: number) {
        const rtv=ctx.createLinearGradient(0,from,0,to),
              colors = <[number, string][]> this.options.linear;

        colors.forEach((item) => {
            rtv.addColorStop(item[0], item[1]);
        })

		return rtv;
    }

    private schedule() {
        const fps = <number> this.options.fps,
              interval = Math.floor(1000 / fps),
              pcmData = <Int8Array> this.pcmData,
              sampleRate = this.sampleRate,
              bufferSize = sampleRate / fps;
		if(!this.drawRefreshTimer){
			this.drawRefreshTimer = setInterval(() => { this.schedule() }, interval);
        };
        
		//切分当前需要的绘制数据
        
        let offset = this.arrayBufferOffset,
            fragment = new Int8Array(Math.min(bufferSize, pcmData.length - offset)),
            length = fragment.length;

        for(let index = 0; index < length; index++) fragment[index] = pcmData[offset + index];

        this.arrayBufferOffset += length;
		
        //推入绘制
        fragment.length && this.draw(fragment, sampleRate);

        //超时没有输入，清除定时器
        !fragment.length && this.pause();

    }

    start() {
        this.schedule()
    }

    pause() {
        clearInterval(this.drawRefreshTimer)
        this.drawRefreshTimer = 0;
    }

    input(pcmData: Uint8Array, sampleRate: number) {
        this.recentInputTime = Date.now();
        this.arrayBufferOffset = 0;
        this.pcmData = new Int8Array(pcmData.buffer);
        this.sampleRate = sampleRate;
		this.schedule();
    }

}
