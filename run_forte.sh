#!/bin/sh

input_file='~matinput'
eval "./topopt_server.py 1234" ${input_file} "&"
severprocess=$!
eval "./matlab.py" ${input_file}
kill -9 $severprocess