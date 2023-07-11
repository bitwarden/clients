class Timer{
    public static sleep(millis: any) {
        return new Promise(resolve => setTimeout(resolve, millis));
        }
} 

export default Timer;