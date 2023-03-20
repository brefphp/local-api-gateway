FROM public.ecr.aws/lambda/provided:al2

# Fake AWS credentials so that the Lambda client works
ENV AWS_ACCESS_KEY_ID='fake'
ENV AWS_SECRET_ACCESS_KEY='fake'

# Install node to run the JS app below
RUN curl --silent --location https://rpm.nodesource.com/setup_16.x | bash -
RUN yum install --setopt=skip_missing_names_on_install=False -y nodejs

WORKDIR /var/task

EXPOSE 8000
