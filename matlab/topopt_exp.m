function topopt_exp(argsfile)
fileid = fopen(argsfile, 'r');
filestr = fscanf(fileid, '%s');
fclose(fileid);


%% debugging
debugging = true;
filestr = strcat(filestr, '&', string(debugging));

for n = 1:10
    filestrexp = filestr;
    %% lambda
    %     lambda = 0.1 * n-0.001;
    %         filestrexp = strcat(filestrexp, '&', string(lambda));
    %% weight
    weight = 0.9+n *0.1;
    filestrexp = strcat(filestrexp, '&', string(weight));
    
    %% run topopt
    args = strsplit(filestrexp, '&');
    try
        xPhys = top88(rand, args);
        colormap(flipud(gray));
        imwrite(1-xPhys, strcat('lambda_', num2str(n), '.png'));
    catch
%         disp(strcat('problem with lambda=', num2str(lambda)));
        continue; end
end
end