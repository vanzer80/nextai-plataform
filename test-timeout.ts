const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TIMEOUT_EXCEEDED')), ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

const run = async () => {
    try {
        await withTimeout(new Promise(res => setTimeout(res, 10000)), 2000);
        console.log("Success");
    } catch (e: any) {
        console.log("Error:", e.message);
    }
}
run();
