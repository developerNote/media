import Log from '../packages/logger'

export default class Audio {

    private audioContext?: AudioContext;

    private source?: AudioBufferSourceNode;

    private analyser?: AnalyserNode;

    private gain?: GainNode;

    constructor() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext();
    }

    async decodeAudioData(audioBuffer: ArrayBuffer) {
        let decodeData = this.audioContext.decodeAudioData(audioBuffer);

        if(!decodeData){
            Log.info('decodeAudioData failure');
            throw new Error('decodeAudioData failure');
        }

        return decodeData;
    }

    destination(audioNode: AudioNode) {
        audioNode.connect(this.audioContext.destination);
    }

    addSource(buffer: AudioBuffer): Promise<Audio> {
        this.source = this.audioContext.createBufferSource();
        this.source.buffer = buffer;
        return Promise.resolve(this);
    }

    connectAnalsyer(audioNode: AudioNode): Promise<AudioNode> {
        this.analyser = this.audioContext.createAnalyser();
        audioNode.connect(this.analyser);
        return Promise.resolve(this.analyser);
    }

    connectGain(audioNode: AudioNode): Promise<AudioNode> {
        this.gain = this.audioContext.createGain();
        audioNode.connect(this.gain);
        return Promise.resolve(this.gain);
    }
}