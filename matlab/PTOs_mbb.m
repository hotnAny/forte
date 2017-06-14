% Proportional Topology Optimization stress (PTOs) - Half MBB Beam - (2015)
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
function x = PTOs_mbb(E0,Emin,L,lv,ld,nelx,nely,nu,penal,q,rmin,vmslim,xlim)
% Setup Finite Element Analysis
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
% Define Loads and Supports
iF = 2*(nely+1)*(0:ld-1)+2; 
jF = ones(1,ld); 
sF = -lv/ld*ones(ld,1);
F = sparse(iF,jF,sF,2*(nely+1)*(nelx+1),1);
% Define Displacement and DOF Sets
U = zeros(2*(nely+1)*(nelx+1),1);
fixeddofs = union(1:2:2*(nely+1),2*((nelx+1)*(nely+1)-ld+1:(nelx+1)*(nely+1)));
alldofs = 1:2*(nely+1)*(nelx+1);
freedofs = setdiff(alldofs,fixeddofs);
% Setup Stress Analysis
B = (1/2/L)*[-1 0 1 0 1 0 -1 0; 0 -1 0 -1 0 1 0 1; -1 -1 -1 1 1 1 1 -1];
DE = (1/(1-nu^2))*[1 nu 0; nu 1 0; 0 0 (1-nu)/2];
% Setup Filter
iW = ones(nelx*nely*(2*(ceil(rmin)-1)+1)^2,1);
jW = ones(size(iW));
sW = zeros(size(iW));
k = 0;
for i1 = 1:nelx
  for j1 = 1:nely
    e1 = (i1-1)*nely+j1;
    for i2 = max(i1-(ceil(rmin)-1),1):min(i1+(ceil(rmin)-1),nelx)
      for j2 = max(j1-(ceil(rmin)-1),1):min(j1+(ceil(rmin)-1),nely)
        e2 = (i2-1)*nely+j2;
        k = k+1;
        iW(k) = e1;
        jW(k) = e2;
        sW(k) = max(0,rmin-sqrt((i1-i2)^2+(j1-j2)^2));
      end
    end
  end
end
w = sparse(iW,jW,sW);
W = bsxfun(@rdivide,w,sum(w,2));
% Initialize Iteration
x = repmat(0.5,nely,nelx);
loop = 0;
% Run Iteration
while (true)
 loop = loop+1;
 % Finite Element Analysis
 E = Emin+x(:)'.^penal*(E0-Emin);
 sK = reshape(KE(:)*E,64*nelx*nely,1); 
 K = sparse(iK,jK,sK); K = (K+K')/2;
 U(freedofs) = K(freedofs,freedofs)\F(freedofs);
 % Stress Calculation
 s = (U(edofMat)*(DE*B)').*repmat(E',1,3);
 vms = reshape(sqrt(sum(s.^2,2)-s(:,1).*s(:,2)+2.*s(:,3).^2),nely,nelx);
 % Compliance Calculation 
 ce = E'.*sum((U(edofMat)*KE).*U(edofMat),2);    
 C = reshape(ce,nely,nelx);
 % Print Results
 fprintf('It:%5i Max_vms:%5.2f Comp:%8.2f Vol:%5.2f Res:%6.3f\n',...
         loop,max(vms(:)),sum(C(:)),mean(x(:)),abs(max(vms(:))-vmslim));
 % Plot Results
 colormap(flipud(gray));
 subplot(2,1,1); imagesc(x); axis equal off; text(2,-2,'x');
 subplot(2,1,2); imagesc(vms); axis equal off; text(2,-2,'vms'); drawnow;
 % Check Stop Criteria
 if (abs(max(vms(:))-vmslim) < 0.001 && loop > 50); break; end;
 % Optimization Algorithm (PTOs)
 if (max(vms(:)) > vmslim)
   xTarget = sum(x(:))+0.001*numel(x);
 else
   xTarget = sum(x(:))-0.001*numel(x);
 end
 xRemaining = xTarget;
 x(:) = 0;
 vms_proportion = vms.^q/sum(sum(vms.^q));
 while (xRemaining > 0.001) 
  xDist = xRemaining.*vms_proportion;
  x(:) = x(:)+W*xDist(:);
  x = max(min(x,xlim(2)),xlim(1));
  xRemaining = xTarget-sum(x(:));  
 end  
end
end