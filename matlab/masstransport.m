function geommean = masstransport(pdf1, pdf2, lambda, niters, kernelsize)
    b1 = ones(size(pdf1));
    b2 = ones(size(pdf1));
    
%     gaussian = fspecial('gaussian', [kernelsize, kernelsize]);
    gaussian = fspecial('gaussian', size(pdf1));
    eps = 1e-12;
   
    for iter = 1:niters
        c1 = conv2(b1, gaussian, 'same');
        c2 = conv2(b2, gaussian, 'same');

        a1 = pdf1./max(eps,c1);
        a2 = pdf2./max(eps,c2);
        c1 = conv2(a1, gaussian, 'same');
        c2 = conv2(a2, gaussian, 'same');
        
        geommean = exp(log(max(eps, c1)) * (1-lambda) + log(max(eps, c2)) * lambda);
        
%         normalized = sum(pdf1(:))./sum(geommean(:));
%         geommean = geommean.*normalized;
        
%         disp(mean(geommean(:)))
        
        b1 = geommean./max(eps,c1);
        b2 = geommean./max(eps,c2);
        
    end
%     colormap(gray); imagesc(1-geommean); caxis([0 1]); axis equal; axis off; drawnow;
end

%
%   do conv2 of u and v s.t. the result has the same sum as u
%
function convolution = nconv2(u, v)
    sumu = sum(u(:));
    c = conv2(u, v, 'same');
    sumc = sum(c(:));
%     disp(sumu./sumc);
    convolution = c.*(sumu./sumc);
end