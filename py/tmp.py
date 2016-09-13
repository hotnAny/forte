#!/usr/bin/env python

dispatch_list = [[]]
for i in xrange(0, 6):
    dispatch_list_new = []
    for subset_list in dispatch_list:
        dispatch_list_new.append(subset_list + [True])
        dispatch_list_new.append(subset_list + [False])
    dispatch_list = list(dispatch_list_new)

for subset_list in dispatch_list:
    print subset_list

# /batch_gen_design.py example_data/hook_01.forte example_data/hook_01_128.delta 128 1 /Users/hotnAny/Dropbox/Codebase/Web/forte/recycle/gen_design_01
