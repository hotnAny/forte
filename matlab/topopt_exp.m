function topopt_exp(argsfile)
    fileid = fopen(argsfile, 'r');
    filestr = fscanf(fileid, '%s');
    fclose(fileid);
    
    debugging = true;
    filestr = strcat(filestr, '&', string(debugging));
    for n = 1:9
        lambda = 0.1 * n-0.001;
        filestrexp = strcat(filestr, '&', string(lambda));
        args = strsplit(filestrexp, '&');
        try
            xPhys = top88(rand, args);
            colormap(flipud(gray));
            imwrite(1-xPhys, strcat('lambda_', num2str(n), '.png')); 
        catch
            disp(strcat('problem with lambda=', num2str(lambda)));
            continue; end
    end
end