function xPhys = top88(trial, args)
%% [xac] input data cleansing
disp(args)
nelx = str2double(args(2));
nely = str2double(args(3));
volfrac = str2double(args(4));
penal = str2double(args(5));
rmin = str2double(args(6));
ft = str2double(args(7));
maxloop = str2double(args(8));
fixeddofs = str2num(char(args(9)));
loadnodes = str2num(char(args(10)));
loadvalues = str2num(char(args(11)));
actvelms = str2num(char(args(12)));
% favelms = str2num(char(args(13)));
pasvelms = str2num(char(args(14)));
distfield = str2num(char(args(15)));
% isadding = size(distfield) == [0, 0];
% isadding = true; % debug
lambda = str2num(char(args(16)));
debugging = str2num(char(args(17)));

%% [xac] mass transport
if lambda > 0
    isadding = true;
    disp('adding structs ...');
else
    isadding = false;
    disp('getting variation ...');
end
niters = 64;
decay = 0.95;
eps = 0.001;
kernelsize = floor(log(max(nelx, nely))) * 2 + 1; %floor(min(nelx, nely)/2);%
sigma=1;
gaussian = fspecial('gaussian', [kernelsize,kernelsize], sigma);

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
% DEFINE LOADS AND SUPPORTS (HALF MBB-BEAM)
%     F = sparse(2*nelx*(nely+1)+1,1,-1,2*(nely+1)*(nelx+1),1); % ORIGINAL:
F = sparse(loadnodes, ones(size(loadnodes)), loadvalues, 2*(nely+1)*(nelx+1),1);
U = zeros(2*(nely+1)*(nelx+1),1);
U0 = U;
%     fixeddofs = union([1:1:2*(nely+1)],[2*(nelx+1)*(nely+1)]); % ORIGINAL
fixeddofs = union(fixeddofs, [2*(nelx+1)*(nely+1)]);
alldofs = [1:2*(nely+1)*(nelx+1)];
freedofs = setdiff(alldofs,fixeddofs);
%% [xac] setup Stress Analysis
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
if isadding
    x = repmat(volfrac,nely,nelx);
else
    x = eps + max(0, distfield-eps);
end

% [xac] eliminate boundary effect
x(1,:) = eps; x(end,:) = eps; x(:,1) = eps; x(:,end) = eps;

% set xPhys to be the original design
xPhys = repmat(eps, nely,nelx);
xPhys(actvelms) = 1;
loop = 0;
change = 1;

% [xac] [exp]
% xOriginal = repmat(eps, nely,nelx);
% xOriginal(actvelms) = 1;
% xOriginal(1,:) = eps; xOriginal(end,:) = eps; xOriginal(:,1) = eps; xOriginal(:,end) = eps;

% minweight = eps;
% weightmap = repmat(1,nely,nelx);
% weightmap(1:64, 1:64) = 10;
% weightmap = weightmap * nely * nelx / sum(weightmap(:));
% weightmap = minweight + max(0, weightmap-minweight);
% x = x .* (1+weightmap);

telapsed = 0;
%% START ITERATION [xac] added maxloop
while change > 0.05 && (loop <= maxloop)
    tic
    loop = loop + 1;
    %% FE-ANALYSIS
    sK = reshape(KE(:)*(Emin+xPhys(:)'.^penal*(E0-Emin)),64*nelx*nely,1);
    K = sparse(iK,jK,sK); K = (K+K')/2;
    U(freedofs) = K(freedofs,freedofs)\F(freedofs);
    
    %% [xac] stress
    E = Emin+xPhys(:)'.^penal*(E0-Emin);
    s = (U(edofMat)*(DE*B)').*repmat(E',1,3);
    vms = reshape(sqrt(sum(s.^2,2)-s(:,1).*s(:,2)+2.*s(:,3).^2),nely,nelx);
    
    %% [xac] log the 'before' results (i.e., skip optimization, just compute displacement and vms
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
    while (l2-l1)/(l1+l2) > 1e-3
        lmid = 0.5*(l2+l1);
        xnew = max(0,max(x-move,min(1,min(x+move,x.*sqrt(-dc./dv/lmid)))));
        if ft == 1
            xPhys = xnew;
        elseif ft == 2
            xPhys(:) = (H*xnew(:))./Hs;
        end
        if sum(xPhys(:)) > volfrac*nelx*nely, l1 = lmid; else l2 = lmid; end
    end
    change = max(abs(xnew(:)-x(:)));
    x = xnew;
    
    %% [xac] set void element to 'zero'
    x(pasvelms) = eps;
    x(1,:) = eps; x(end,:) = eps; x(:,1) = eps; x(:,end) = eps;
    
    %% [xac] [exp] mass transport
    if lambda > 0
        x = masstransport(x, max(0, distfield-eps), lambda, niters, kernelsize);
        lambda = lambda * decay;
    end
    
    %% [xac] add structs
    if isadding x(actvelms) = 1; end
    
    %% [xac] update xPhys
    xPhys = x;
    %     xPhys = conv2(x, gaussian, 'same');
    
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