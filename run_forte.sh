#!/bin/sh

input_file='~matinput'
eval "./top88_server.py 1234" ${input_file} "&"
severprocess=$!
eval "./start_matlab.py" ${input_file}
kill -9 $severprocess