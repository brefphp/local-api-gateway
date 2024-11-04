import json

import pulumi
import pulumi_aws as aws
import pulumi_awsx as awsx

stack = pulumi.get_stack()

local_api_gateway_repository = aws.ecr.Repository(
    f"{stack}-local-api-gateway-repository",
    name=f"{stack}-local-api-gateway-repository",
    image_tag_mutability="MUTABLE",
    opts=pulumi.ResourceOptions(protect=True),
)
local_api_gateway_repo_policy = aws.ecr.RepositoryPolicy(
    f"{stack}-local-api-gateway-repository-policy",
    repository=local_api_gateway_repository.name,
    policy=json.dumps(
        {
            "Version": "2008-10-17",
            "Statement": [
                {
                    "Sid": "new policy",
                    "Effect": "Allow",
                    "Principal": "*",
                    "Action": [
                        "ecr:GetDownloadUrlForLayer",
                        "ecr:BatchGetImage",
                        "ecr:BatchCheckLayerAvailability",
                        "ecr:PutImage",
                        "ecr:InitiateLayerUpload",
                        "ecr:UploadLayerPart",
                        "ecr:CompleteLayerUpload",
                        "ecr:DescribeRepositories",
                        "ecr:GetRepositoryPolicy",
                        "ecr:ListImages",
                        "ecr:DeleteRepository",
                        "ecr:BatchDeleteImage",
                        "ecr:SetRepositoryPolicy",
                        "ecr:DeleteRepositoryPolicy",
                    ],
                }
            ],
        }
    ),
)
# Save money by expiring old images
local_api_gateway_repo_lifecycle_policy = aws.ecr.LifecyclePolicy(
    f"{stack}-local_api_gateway_repository-repo-lifecycle-policy",
    repository=local_api_gateway_repository.name,
    policy=json.dumps(
        {
            "rules": [
                {
                    "rulePriority": 1,
                    "description": "Expire images if more than 10 exist",
                    "selection": {
                        "tagStatus": "any",
                        "countType": "imageCountMoreThan",
                        "countNumber": 10,
                    },
                    "action": {"type": "expire"},
                }
            ]
        }
    ),
)

local_api_gateway_image = awsx.ecr.Image(
    resource_name=f"{stack}-local-api-gateway-image",
    repository_url=local_api_gateway_repository.repository_url,
    context="../",
    dockerfile="../Dockerfile",
)

pulumi.export(
    f"{stack}-local-api-gateway-image-name", local_api_gateway_image.image_uri
)
