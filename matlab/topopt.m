%%%% AN 88 LINE TOPOLOGY OPTIMIZATION CODE Nov, 2010 %%%%
function topopt(argsfile)
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

        args = strsplit(filestr, '&');
        trial = char(args(1));
        if strcmp(trial, prevtrial) continue; end
        try
            prevtrial = trial;
            top88(trial, args);
        catch ME
            disp(ME.message);
            continue;
        end
%         break;
    end
end
