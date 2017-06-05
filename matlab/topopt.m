%%%% AN 88 LINE TOPOLOGY OPTIMIZATION CODE Nov, 2010 %%%%
% function top88(trial, nelx,nely,volfrac,penal,rmin,ft,maxloop,fixeddofs,loadnodes,loadvalues)
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
end
% colormap(gray); imagesc(1-xPhys); caxis([0 1]); axis equal; axis off; drawnow;
% 
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% This Matlab code was written by E. Andreassen, A. Clausen, M. Schevenels,%
% B. S. Lazarov and O. Sigmund,  Department of Solid  Mechanics,           %
%  Technical University of Denmark,                                        %
%  DK-2800 Lyngby, Denmark.                                                %
% Please sent your comments to: sigmund@fam.dtu.dk                         %
%                                                                          %
% The code is intended for educational purposes and theoretical details    %
% are discussed in the paper                                               %
% "Efficient topology optimization in MATLAB using 88 lines of code,       %
% E. Andreassen, A. Clausen, M. Schevenels,                                %
% B. S. Lazarov and O. Sigmund, Struct Multidisc Optim, 2010               %
% This version is based on earlier 99-line code                            %
% by Ole Sigmund (2001), Structural and Multidisciplinary Optimization,    %
% Vol 21, pp. 120--127.                                                    %
%                                                                          %
% The code as well as a postscript version of the paper can be             %
% downloaded from the web-site: http://www.topopt.dtu.dk                   %
%                                                                          %
% Disclaimer:                                                              %
% The authors reserves all rights but do not guaranty that the code is     %
% free from errors. Furthermore, we shall not be liable in any event       %
% caused by the use of the program.                                        %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
