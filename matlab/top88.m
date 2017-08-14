function xPhys = top88(trial, args)
%% [forte] const variables
ADDSTRUCTS = 0;
GETVARIATION = 1;
OPTIMIZEWITHIN = 2;
MAXEDITWEIGHT = 128;

%% [forte] input data cleansing
disp(args)
% [forte] basic design info
nelx = str2double(args(2));
nely = str2double(args(3));
volfrac = str2double(args(4));
penal = str2double(args(5));
rmin = str2double(args(6));
ft = str2double(args(7));
maxloop = str2double(args(8));
% [forte] performance requirements
fixeddofs = str2num(char(args(9)));
loadnodes = str2num(char(args(10)));
loadvalues = str2num(char(args(11)));
% [forte] mixed-initiative optimization
type = str2num(char(args(19)));
actvelms = str2num(char(args(12)));
pasvelms = str2num(char(args(14)));
distfield = str2num(char(args(15)));
lambda = str2double(args(16));
% [forte] continuous user editing
lastoutput = char(args(18));
favelms = str2num(char(args(13)));
slimelms = str2num(char(args(17)));
editweight = str2num(char(args(20)));
% [forte] for debugging in matlab
debugging = str2num(char(args(21)));

%% [forte] variables for mixed-initiative design optimization
niters = 64;
decay = 0.95;
eps = 0.001;
kernelsize = floor(log(max(nelx, nely))) * 2 + 1; %floor(min(nelx, nely)/2);%
sigma=1;
gaussian = fspecial('gaussian', [kernelsize,kernelsize], sigma);
margin = 2;
margindecay = 0.01;
telapsed = 0;

%% MATERIAL PROPERTIES
E0 = 1;
Emin = 1e-9;
nu = 0.3;
%% PREPARE FINITE ELEMENT ANALYSIS
A11 = [12  3 -6 -3;  3 12  3  0; -6  3 12 -3; -3  0 -3 12];
A12 = [-6 -3  0  3; -3 -6 -3 -6;  0 -3 -6  3;  3 -6  3 -6];
B11 = [-4  3 -2  9;  3 -4 -9  4; -2 -9 -4 -3;  9  4 -3 -4];
B12 = [ 2 -3  4 -9; -3  2  9 -2;  4  9  2  3; -9 -2  3  2];
KE = 1/(1-nu^2)/24*([A11 A12;A12' A11]+nu*[B11 B12;B12' B11]);
nodenrs = reshape(1:(1+nelx)*(1+nely),1+nely,1+nelx);
edofVec = reshape(2*nodenrs(1:end-1,1:end-1)+1,nelx*nely,1);
edofMat = repmat(edofVec,1,8)+repmat([0 1 2*nely+[2 3 0 1] -2 -1],nelx*nely,1);
iK = reshape(kron(edofMat,ones(8,1))',64*nelx*nely,1);
jK = reshape(kron(edofMat,ones(1,8))',64*nelx*nely,1);
%% DEFINE LOADS AND SUPPORTS
F = sparse(loadnodes, ones(size(loadnodes)), loadvalues, 2*(nely+1)*(nelx+1),1);
U = zeros(2*(nely+1)*(nelx+1),1);
U0 = U;
fixeddofs = union(fixeddofs, [2*(nelx+1)*(nely+1)]);
alldofs = [1:2*(nely+1)*(nelx+1)];
freedofs = setdiff(alldofs,fixeddofs);
%% [forte] setup Stress Analysis
L=1;
B = (1/2/L)*[-1 0 1 0 1 0 -1 0; 0 -1 0 -1 0 1 0 1; -1 -1 -1 1 1 1 1 -1];
DE = (1/(1-nu^2))*[1 nu 0; nu 1 0; 0 0 (1-nu)/2];
%% PREPARE FILTER
iH = ones(nelx*nely*(2*(ceil(rmin)-1)+1)^2,1);
jH = ones(size(iH));
sH = zeros(size(iH));
k = 0;
for i1 = 1:nelx
    for j1 = 1:nely
        e1 = (i1-1)*nely+j1;
        for i2 = max(i1-(ceil(rmin)-1),1):min(i1+(ceil(rmin)-1),nelx)
            for j2 = max(j1-(ceil(rmin)-1),1):min(j1+(ceil(rmin)-1),nely)
                e2 = (i2-1)*nely+j2;
                k = k+1;
                iH(k) = e1;
                jH(k) = e2;
                sH(k) = max(0,rmin-sqrt((i1-i2)^2+(j1-j2)^2));
            end
        end
    end
end
H = sparse(iH,jH,sH);
Hs = sum(H,2);
%% INITIALIZE ITERATION
if type == ADDSTRUCTS
    x = repmat(volfrac,nely,nelx);
    disp('adding structs ...');
elseif type == GETVARIATION
    x = eps + max(0, distfield-eps);
    disp('getting variation ...');
elseif type == OPTIMIZEWITHIN
    x = repmat(volfrac,nely,nelx);
    mindf = min(distfield(:));
    maxdf = max(distfield(:)) / 2;
    lowend = mindf+(maxdf-mindf)*max(0.001, lambda)
    highend = lowend + 0.03 ^ (1+lambda)
    disp('optimizing within ...');
end
%% [forte] set xPhys to be the original design
xPhys = repmat(eps, nely,nelx);
xPhys(actvelms) = 1;
loop = 0;
change = 1;

%% [forte] see if this is a continuous optimization
try
    fileid = fopen(lastoutput, 'r');
    filestr = fread(fileid, inf, 'uint8=>char')';
    fclose(fileid);
    strx = strrep(filestr, '\n', ';');
    x = str2num(strx);
    x(favelms) = 1;
catch
    disp('cannot read previous results ...');
end

%% [forte] mask for removing material by the user
% editweight = MAXEDITWEIGHT;
matmask = ones(nely,nelx);
if editweight < MAXEDITWEIGHT
    alpha = 0.75 * editweight;
    beta = 1.25 * editweight;
    matmask(slimelms) = 1 - alpha;
    matmask(favelms) = 1 + beta;
    gaussianmask = fspecial('gaussian', [kernelsize,kernelsize], 1);
    matmask = conv2(matmask, gaussianmask, 'same');
    matmask = matmask * nely * nelx / sum(matmask(:));
end

%% START ITERATION [forte] added maxloop
while change > 0.05 && (loop <= maxloop)
    tic
    loop = loop + 1;
    %% FE-ANALYSIS
    sK = reshape(KE(:)*(Emin+xPhys(:)'.^penal*(E0-Emin)),64*nelx*nely,1);
    K = sparse(iK,jK,sK); K = (K+K')/2;
    U(freedofs) = K(freedofs,freedofs)\F(freedofs);
    
    %% [forte] stress
    E = Emin+xPhys(:)'.^penal*(E0-Emin);
    s = (U(edofMat)*(DE*B)').*repmat(E',1,3);
    vms = reshape(sqrt(sum(s.^2,2)-s(:,1).*s(:,2)+2.*s(:,3).^2),nely,nelx);
    
    %% [forte] log the 'before' results (i.e., skip optimization, just compute displacement and vms
    if loop==1 U0 = U; vms0 = vms; xPhys = x; continue; end
    
    %% OBJECTIVE FUNCTION AND SENSITIVITY ANALYSIS
    ce = reshape(sum((U(edofMat)*KE).*U(edofMat),2),nely,nelx);
    c = sum(sum((Emin+xPhys.^penal*(E0-Emin)).*ce));
    dc = -penal*(E0-Emin)*xPhys.^(penal-1).*ce;
    dv = ones(nely,nelx);
    %% FILTERING/MODIFICATION OF SENSITIVITIES
    if ft == 1
        dc(:) = H*(x(:).*dc(:))./Hs./max(1e-3,x(:));
    elseif ft == 2
        dc(:) = H*(dc(:)./Hs);
        dv(:) = H*(dv(:)./Hs);
    end
    %% OPTIMALITY CRITERIA UPDATE OF DESIGN VARIABLES AND PHYSICAL DENSITIES
    l1 = 0; l2 = 1e9; move = 0.2;
    maxinnerloop = 1e4; innerloop = 0;
    while (l2-l1)/(l1+l2) > 1e-3
        innerloop = innerloop + 1;
        if(innerloop > maxinnerloop) break; end
        lmid = 0.5*(l2+l1);
        % ORIGINAL: xnew = max(0,max(x-move,min(1,min(x+move,x.*sqrt(-dc./dv/lmid)))));
        xnew = max(0,max(x-move,min(1,min(x+move,x.*matmask.*sqrt(-dc./dv/lmid)))));
        if ft == 1
            xPhys = xnew;
        elseif ft == 2
            xPhys(:) = (H*xnew(:))./Hs;
        end
        if sum(xPhys(:)) > volfrac*nelx*nely, l1 = lmid; else l2 = lmid; end
    end
    change = max(abs(xnew(:)-x(:)));
    x = xnew;
    
    %% [forte] forte optimization
    % add structs
    if type == ADDSTRUCTS
        % mass transport
        if lambda > 0
            x = masstransport(x, max(0, distfield-eps), lambda, niters, kernelsize);
            lambda = lambda * decay;
            % keep original sketch
            x(actvelms) = 1;
        end
        % get varation
    elseif type == GETVARIATION
        % do nothing
        % optimize within
    elseif type == OPTIMIZEWITHIN
        % optimize within
        x = min(1, x + (lowend<distfield & distfield<=highend));
        x = max(eps, x - (distfield > highend));
    end
    
     %% [forte] set void element to 'zero'
    x(pasvelms) = eps;
    
    %% [forte] with max edit weight, set the element to 'one' / 'zero'
    if editweight >= MAXEDITWEIGHT
        x(slimelms) = eps;
        x(favelms) = 1;
    end
    
    %% [forte] avoid boundary effects
    x([1, margin],:) = x([1, margin],:) * margindecay; 
    x([end-margin, end],:) = x([end-margin, end],:) * margindecay;
    x(:,[1, margin]) = x(:,[1, margin]) * margindecay; 
    x(:,[end-margin, end]) = x(:,[end-margin, end]) * margindecay;
    
    %% [forte] update xPhys
    xPhys = x;
    
    %% PRINT RESULTS
    t = toc;
    telapsed = telapsed + t;
    fprintf(' It.:%3i t:%1.3f Obj.:%11.4f Vol.:%7.3f ch.:%7.3f\n',loop-1,t,c, ...
        mean(x(:)),change);
    
    %% PLOT DENSITIES
    smoothed = xPhys;
    smoothed = conv2(smoothed, gaussian, 'same');
    
    if debugging
        colormap(flipud(gray));
        subplot(2,1,1); imagesc(smoothed); axis equal off; text(2,-2,'x');
        subplot(2,1,2); imagesc(vms); axis equal off; text(2,-2,'vms');
        drawnow;
    end
    
    %% [forte] log data
    try dlmwrite(strcat(trial, '_', num2str(loop-1), '.out'), smoothed);
    catch ME
        if debugging == true
            continue;
        else
            disp('received indication to quit');
            break;
        end
    end
end
disp('avg time per itr:');
disp(telapsed/(loop-1));
disp('sum of material:');
disp(sum(xPhys(:))/(nely*nelx));
xPhys = smoothed;
while(debugging==false)
    try
        dlmwrite(strcat(trial, '_before.dsp'), U0);
        dlmwrite(strcat(trial, '_after.dsp'), U);
        dlmwrite(strcat(trial, '_before.vms'), vms0);
        dlmwrite(strcat(trial, '_after.vms'), vms);
        break;
    catch
        continue;
    end
end
end