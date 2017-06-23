function topopt(argsfile)
    debugging = false;
    disp('topopt service started ...');
    prevtrial = '';
    while(true)
        %% read input file
        filestr = '';
        while(true)
            try
                fileid = fopen(argsfile, 'r');
                filestr = fscanf(fileid, '%s');
                fclose(fileid);
            catch
                continue;
            end
            break;
        end

        filestr = strcat(filestr, '&', string(debugging));
        args = strsplit(filestr, '&');
        trial = char(args(1));
        if strcmp(trial, prevtrial) continue; end
        prevtrial = trial;
        if debugging==true 
            top88(trial, args);
            break; 
        else
            try
                top88(trial, args);
            catch ME
                disp(ME.message);
                continue;
            end
        end 
    end
end
