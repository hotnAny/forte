## Caveat
The current version is limited to a few platforms. Let me know if you'd like to run Forté on something different.
* '''The MATLAB setup is specific for Mac OS.'''
* '''The client-server communication currently is set up for Google Chrome only.'''

## Installation
* Install the latest [MATLAB runtime](https://www.mathworks.com/products/compiler/matlab-runtime.html) to run compiled MATLAB application for topology optimization.
* Install Python if you haven't.


## Running Forté
1. Open Terminal, navigate to Forté's directory
```shell
cd forte-master
```

2. Start Forté backend
```shell
./run_forte.py
```

3. Start a local server for Forté front end
```shell
./serverup.py 8888
```

4. Start Chrome with flags to enable client-server communication
```shell
./chrome.py
```

5. In Chrome, navigate to http://127.0.0.1:8888/

## Resources
To learn more about Project Forté, please visit the [project page](http://web.xiangchen.me/#forteacute).