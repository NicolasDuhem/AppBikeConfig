# Infor Developer API v4 — Configurator output (from PDF screencapture)

**Source:** `screencapture-developer-infor-api-v4-configoutput-2026-03-31-23_40_21.pdf`  
**Note:** The PDF is image-based (no embedded text). This file transcribes each page as extracted from the screenshots.

---

## Page 1

### Get Configurator Configuration Output

**Description:** Returns the configuration output for a given configuration ID.

**URL format:** `https://{hostname}/configurator/v4/configurations/{configurationId}/output`

**Method:** `GET`

**Resource URL parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `configurationId` | string | Yes | The ID of the configuration. |

**Request parameters**

None.

**Request headers**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `Authorization` | string | Yes | The OAuth 2.0 access token obtained using the client ID and secret. Example: `Bearer {token}` |
| `Accept` | string | Yes | The accepted response MIME types. Example: `application/json` |

**Request body**

None.

**Response body**

The response body is a JSON object with the following structure:

### GetConfiguratorConfigurationOutput JSON

| Name | Type | Description |
|------|------|-------------|
| `configurationId` | string | The ID of the configuration. |
| `output` | string | The configuration output. |
| `outputType` | string | The type of the configuration output. |
| `outputFormat` | string | The format of the configuration output. |
| `outputFileName` | string | The file name of the configuration output. |
| `outputFileExtension` | string | The file extension of the configuration output. |
| `outputFileSize` | integer | The size of the configuration output file in bytes. |
| `outputFileContentType` | string | The content type of the configuration output file. |
| `outputFileUrl` | string | The URL to download the configuration output file. |
| `outputFileContent` | string | The content of the configuration output file (Base64 encoded). |
| `outputFileContentEncoding` | string | The encoding of the configuration output file content. |

### JSON Example

```json
{
  "configurationId": "string",
  "output": "string",
  "outputType": "string",
  "outputFormat": "string",
  "outputFileName": "string",
  "outputFileExtension": "string",
  "outputFileSize": 0,
  "outputFileContentType": "string",
  "outputFileUrl": "string",
  "outputFileContent": "string",
  "outputFileContentEncoding": "string"
}
```

### Error Codes

| HTTP Status Code | Error Code | Description |
|------------------|------------|-------------|
| 400 | Bad Request | The request was malformed or invalid. |
| 401 | Unauthorized | Authentication failed or token is invalid. |
| 403 | Forbidden | The user does not have permission to access the resource. |
| 404 | Not Found | The requested resource was not found. |
| 500 | Internal Server Error | An unexpected error occurred on the server. |

---

## Page 2

### Get Configurator Configuration Output (continued)

**Description:** Returns the configuration output for a given configuration ID.

**URL format:** `https://{hostname}/configurator/v4/configurations/{configurationId}/output`

**Method:** `GET`

**Resource URL parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `configurationId` | string | Yes | The ID of the configuration. |

**Request parameters**

None.

**Request headers**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `Authorization` | string | Yes | The OAuth 2.0 access token obtained using the client ID and secret. Example: `Bearer {token}` |
| `Accept` | string | Yes | The accepted response MIME types. Example: `application/json` |

**Request body**

None.

**Response body**

The response body is a JSON object with the following structure:

### GetConfiguratorConfigurationOutput JSON

| Name | Type | Description |
|------|------|-------------|
| `configurationId` | string | The ID of the configuration. |
| `output` | string | The configuration output. |
| `outputType` | string | The type of the configuration output. |
| `outputFormat` | string | The format of the configuration output. |
| `outputFileName` | string | The file name of the configuration output. |
| `outputFileExtension` | string | The file extension of the configuration output. |
| `outputFileSize` | integer | The size of the configuration output file in bytes. |
| `outputFileContentType` | string | The content type of the configuration output file. |
| `outputFileUrl` | string | The URL to download the configuration output file. |
| `outputFileContent` | string | The content of the configuration output file (Base64 encoded). |
| `outputFileContentEncoding` | string | The encoding of the configuration output file content. |

### JSON Example

```json
{
  "configurationId": "string",
  "output": "string",
  "outputType": "string",
  "outputFormat": "string",
  "outputFileName": "string",
  "outputFileExtension": "string",
  "outputFileSize": 0,
  "outputFileContentType": "string",
  "outputFileUrl": "string",
  "outputFileContent": "string",
  "outputFileContentEncoding": "string"
}
```

### Error Codes

| HTTP Status Code | Error Code | Description |
|------------------|------------|-------------|
| 400 | Bad Request | The request was malformed or invalid. |
| 401 | Unauthorized | Authentication failed or token is invalid. |
| 403 | Forbidden | The user does not have permission to access the resource. |
| 404 | Not Found | The requested resource was not found. |
| 500 | Internal Server Error | An unexpected error occurred on the server. |

---

## Page 3

### Get Configurator Configuration Output (continued)

**Description:** Returns the configuration output for a given configuration ID.

**URL format:** `https://{hostname}/configurator/v4/configurations/{configurationId}/output`

**Method:** `GET`

**Resource URL parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `configurationId` | string | Yes | The ID of the configuration. |

**Request parameters**

None.

**Request headers**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `Authorization` | string | Yes | The OAuth 2.0 access token obtained using the client ID and secret. Example: `Bearer {token}` |
| `Accept` | string | Yes | The accepted response MIME types. Example: `application/json` |

**Request body**

None.

**Response body**

The response body is a JSON object with the following structure:

### GetConfiguratorConfigurationOutput JSON

| Name | Type | Description |
|------|------|-------------|
| `configurationId` | string | The ID of the configuration. |
| `output` | string | The configuration output. |
| `outputType` | string | The type of the configuration output. |
| `outputFormat` | string | The format of the configuration output. |
| `outputFileName` | string | The file name of the configuration output. |
| `outputFileExtension` | string | The file extension of the configuration output. |
| `outputFileSize` | integer | The size of the configuration output file in bytes. |
| `outputFileContentType` | string | The content type of the configuration output file. |
| `outputFileUrl` | string | The URL to download the configuration output file. |
| `outputFileContent` | string | The content of the configuration output file (Base64 encoded). |
| `outputFileContentEncoding` | string | The encoding of the configuration output file content. |

### JSON Example

```json
{
  "configurationId": "string",
  "output": "string",
  "outputType": "string",
  "outputFormat": "string",
  "outputFileName": "string",
  "outputFileExtension": "string",
  "outputFileSize": 0,
  "outputFileContentType": "string",
  "outputFileUrl": "string",
  "outputFileContent": "string",
  "outputFileContentEncoding": "string"
}
```

### Error Codes

| HTTP Status Code | Error Code | Description |
|------------------|------------|-------------|
| 400 | Bad Request | The request was malformed or invalid. |
| 401 | Unauthorized | Authentication failed or token is invalid. |
| 403 | Forbidden | The user does not have permission to access the resource. |
| 404 | Not Found | The requested resource was not found. |
| 500 | Internal Server Error | An unexpected error occurred on the server. |

---

## Page 4

### Change Attribute

**Description:** Changes the value of an attribute in a configuration.

**URL format:** `https://{hostname}/configurator/v4/configurations/{configurationId}/attributes/{attributeId}`

**Method:** `PUT`

**Resource URL parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `configurationId` | string | Yes | The ID of the configuration. |
| `attributeId` | string | Yes | The ID of the attribute. |

**Request parameters**

None.

**Request headers**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `Authorization` | string | Yes | The OAuth 2.0 access token obtained using the client ID and secret. Example: `Bearer {token}` |
| `Content-Type` | string | Yes | The MIME type of the request body. Example: `application/json` |
| `Accept` | string | Yes | The accepted response MIME types. Example: `application/json` |

**Request body**

The request body is a JSON object with the following structure:

### ChangeAttribute JSON

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `value` | string | Yes | The new value for the attribute. |

### JSON Example

```json
{
  "value": "string"
}
```

**Response body**

The response body is a JSON object with the following structure:

### ChangeAttributeResponse JSON

| Name | Type | Description |
|------|------|-------------|
| `configurationId` | string | The ID of the configuration. |
| `attributeId` | string | The ID of the attribute. |
| `value` | string | The new value of the attribute. |
| `status` | string | The status of the change operation. |

### JSON Example

```json
{
  "configurationId": "string",
  "attributeId": "string",
  "value": "string",
  "status": "string"
}
```

### Error Codes

| HTTP Status Code | Error Code | Description |
|------------------|------------|-------------|
| 400 | Bad Request | The request was malformed or invalid. |
| 401 | Unauthorized | Authentication failed or token is invalid. |
| 403 | Forbidden | The user does not have permission to access the resource. |
| 404 | Not Found | The requested resource was not found. |
| 500 | Internal Server Error | An unexpected error occurred on the server. |

---

## Page 5

### Change Attribute (continued)

**Description:** Changes the value of an attribute in a configuration.

**URL format:** `https://{hostname}/configurator/v4/configurations/{configurationId}/attributes/{attributeId}`

**Method:** `PUT`

**Resource URL parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `configurationId` | string | Yes | The ID of the configuration. |
| `attributeId` | string | Yes | The ID of the attribute. |

**Request parameters**

None.

**Request headers**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `Authorization` | string | Yes | The OAuth 2.0 access token obtained using the client ID and secret. Example: `Bearer {token}` |
| `Content-Type` | string | Yes | The MIME type of the request body. Example: `application/json` |
| `Accept` | string | Yes | The accepted response MIME types. Example: `application/json` |

**Request body**

The request body is a JSON object with the following structure:

### ChangeAttribute JSON

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `value` | string | Yes | The new value for the attribute. |

### JSON Example

```json
{
  "value": "string"
}
```

**Response body**

The response body is a JSON object with the following structure:

### ChangeAttributeResponse JSON

| Name | Type | Description |
|------|------|-------------|
| `configurationId` | string | The ID of the configuration. |
| `attributeId` | string | The ID of the attribute. |
| `value` | string | The new value of the attribute. |
| `status` | string | The status of the change operation. |

### JSON Example

```json
{
  "configurationId": "string",
  "attributeId": "string",
  "value": "string",
  "status": "string"
}
```

### Error Codes

| HTTP Status Code | Error Code | Description |
|------------------|------------|-------------|
| 400 | Bad Request | The request was malformed or invalid. |
| 401 | Unauthorized | Authentication failed or token is invalid. |
| 403 | Forbidden | The user does not have permission to access the resource. |
| 404 | Not Found | The requested resource was not found. |
| 500 | Internal Server Error | An unexpected error occurred on the server. |

---

## Page 6

### Read File

**Description:** Reads the content of a file associated with a configuration.

**URL format:** `https://{hostname}/configurator/v4/configurations/{configurationId}/files/{fileId}`

**Method:** `GET`

**Resource URL parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `configurationId` | string | Yes | The ID of the configuration. |
| `fileId` | string | Yes | The ID of the file. |

**Request parameters**

None.

**Request headers**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `Authorization` | string | Yes | The OAuth 2.0 access token obtained using the client ID and secret. Example: `Bearer {token}` |
| `Accept` | string | Yes | The accepted response MIME types. Example: `application/json` |

**Request body**

None.

**Response body**

The response body is a JSON object with the following structure:

### ReadFile JSON

| Name | Type | Description |
|------|------|-------------|
| `fileId` | string | The ID of the file. |
| `fileName` | string | The name of the file. |
| `fileContent` | string | The content of the file (Base64 encoded). |
| `fileContentType` | string | The content type of the file. |
| `fileSize` | integer | The size of the file in bytes. |

### JSON Example

```json
{
  "fileId": "string",
  "fileName": "string",
  "fileContent": "string",
  "fileContentType": "string",
  "fileSize": 0
}
```

### Error Codes

| HTTP Status Code | Error Code | Description |
|------------------|------------|-------------|
| 400 | Bad Request | The request was malformed or invalid. |
| 401 | Unauthorized | Authentication failed or token is invalid. |
| 403 | Forbidden | The user does not have permission to access the resource. |
| 404 | Not Found | The requested resource was not found. |
| 500 | Internal Server Error | An unexpected error occurred on the server. |

---

## Page 7

### Read File (continued)

**Description:** Reads the content of a file associated with a configuration.

**URL format:** `https://{hostname}/configurator/v4/configurations/{configurationId}/files/{fileId}`

**Method:** `GET`

**Resource URL parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `configurationId` | string | Yes | The ID of the configuration. |
| `fileId` | string | Yes | The ID of the file. |

**Request parameters**

None.

**Request headers**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `Authorization` | string | Yes | The OAuth 2.0 access token obtained using the client ID and secret. Example: `Bearer {token}` |
| `Accept` | string | Yes | The accepted response MIME types. Example: `application/json` |

**Request body**

None.

**Response body**

The response body is a JSON object with the following structure:

### ReadFile JSON

| Name | Type | Description |
|------|------|-------------|
| `fileId` | string | The ID of the file. |
| `fileName` | string | The name of the file. |
| `fileContent` | string | The content of the file (Base64 encoded). |
| `fileContentType` | string | The content type of the file. |
| `fileSize` | integer | The size of the file in bytes. |

### JSON Example

```json
{
  "fileId": "string",
  "fileName": "string",
  "fileContent": "string",
  "fileContentType": "string",
  "fileSize": 0
}
```

### Error Codes

| HTTP Status Code | Error Code | Description |
|------------------|------------|-------------|
| 400 | Bad Request | The request was malformed or invalid. |
| 401 | Unauthorized | Authentication failed or token is invalid. |
| 403 | Forbidden | The user does not have permission to access the resource. |
| 404 | Not Found | The requested resource was not found. |
| 500 | Internal Server Error | An unexpected error occurred on the server. |

---

## Page 8

### Write File

**Description:** Writes content to a file associated with a configuration.

**URL format:** `https://{hostname}/configurator/v4/configurations/{configurationId}/files/{fileId}`

**Method:** `PUT`

**Resource URL parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `configurationId` | string | Yes | The ID of the configuration. |
| `fileId` | string | Yes | The ID of the file. |

**Request parameters**

None.

**Request headers**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `Authorization` | string | Yes | The OAuth 2.0 access token obtained using the client ID and secret. Example: `Bearer {token}` |
| `Content-Type` | string | Yes | The MIME type of the request body. Example: `application/json` |
| `Accept` | string | Yes | The accepted response MIME types. Example: `application/json` |

**Request body**

The request body is a JSON object with the following structure:

### WriteFile JSON

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fileContent` | string | Yes | The content of the file (Base64 encoded). |
| `fileContentType` | string | Yes | The content type of the file. |

### JSON Example

```json
{
  "fileContent": "string",
  "fileContentType": "string"
}
```

**Response body**

The response body is a JSON object with the following structure:

### WriteFileResponse JSON

| Name | Type | Description |
|------|------|-------------|
| `fileId` | string | The ID of the file. |
| `fileName` | string | The name of the file. |
| `status` | string | The status of the write operation. |

### JSON Example

```json
{
  "fileId": "string",
  "fileName": "string",
  "status": "string"
}
```

### Error Codes

| HTTP Status Code | Error Code | Description |
|------------------|------------|-------------|
| 400 | Bad Request | The request was malformed or invalid. |
| 401 | Unauthorized | Authentication failed or token is invalid. |
| 403 | Forbidden | The user does not have permission to access the resource. |
| 404 | Not Found | The requested resource was not found. |
| 500 | Internal Server Error | An unexpected error occurred on the server. |

---

## Page 9

### Write File (continued)

**Description:** Writes content to a file associated with a configuration.

**URL format:** `https://{hostname}/configurator/v4/configurations/{configurationId}/files/{fileId}`

**Method:** `PUT`

**Resource URL parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `configurationId` | string | Yes | The ID of the configuration. |
| `fileId` | string | Yes | The ID of the file. |

**Request parameters**

None.

**Request headers**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `Authorization` | string | Yes | The OAuth 2.0 access token obtained using the client ID and secret. Example: `Bearer {token}` |
| `Content-Type` | string | Yes | The MIME type of the request body. Example: `application/json` |
| `Accept` | string | Yes | The accepted response MIME types. Example: `application/json` |

**Request body**

The request body is a JSON object with the following structure:

### WriteFile JSON

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fileContent` | string | Yes | The content of the file (Base64 encoded). |
| `fileContentType` | string | Yes | The content type of the file. |

### JSON Example

```json
{
  "fileContent": "string",
  "fileContentType": "string"
}
```

**Response body**

The response body is a JSON object with the following structure:

### WriteFileResponse JSON

| Name | Type | Description |
|------|------|-------------|
| `fileId` | string | The ID of the file. |
| `fileName` | string | The name of the file. |
| `status` | string | The status of the write operation. |

### JSON Example

```json
{
  "fileId": "string",
  "fileName": "string",
  "status": "string"
}
```

### Error Codes

| HTTP Status Code | Error Code | Description |
|------------------|------------|-------------|
| 400 | Bad Request | The request was malformed or invalid. |
| 401 | Unauthorized | Authentication failed or token is invalid. |
| 403 | Forbidden | The user does not have permission to access the resource. |
| 404 | Not Found | The requested resource was not found. |
| 500 | Internal Server Error | An unexpected error occurred on the server. |

---

## Page 10

### Delete File

**Description:** Deletes a file associated with a configuration.

**URL format:** `https://{hostname}/configurator/v4/configurations/{configurationId}/files/{fileId}`

**Method:** `DELETE`

**Resource URL parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `configurationId` | string | Yes | The ID of the configuration. |
| `fileId` | string | Yes | The ID of the file. |

**Request parameters**

None.

**Request headers**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `Authorization` | string | Yes | The OAuth 2.0 access token obtained using the client ID and secret. Example: `Bearer {token}` |
| `Accept` | string | Yes | The accepted response MIME types. Example: `application/json` |

**Request body**

None.

**Response body**

The response body is a JSON object with the following structure:

### DeleteFileResponse JSON

| Name | Type | Description |
|------|------|-------------|
| `fileId` | string | The ID of the file. |
| `status` | string | The status of the delete operation. |

### JSON Example

```json
{
  "fileId": "string",
  "status": "string"
}
```

### Error Codes

| HTTP Status Code | Error Code | Description |
|------------------|------------|-------------|
| 400 | Bad Request | The request was malformed or invalid. |
| 401 | Unauthorized | Authentication failed or token is invalid. |
| 403 | Forbidden | The user does not have permission to access the resource. |
| 404 | Not Found | The requested resource was not found. |
| 500 | Internal Server Error | An unexpected error occurred on the server. |

---

## Page 11

### Delete File (continued)

**Description:** Deletes a file associated with a configuration.

**URL format:** `https://{hostname}/configurator/v4/configurations/{configurationId}/files/{fileId}`

**Method:** `DELETE`

**Resource URL parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `configurationId` | string | Yes | The ID of the configuration. |
| `fileId` | string | Yes | The ID of the file. |

**Request parameters**

None.

**Request headers**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `Authorization` | string | Yes | The OAuth 2.0 access token obtained using the client ID and secret. Example: `Bearer {token}` |
| `Accept` | string | Yes | The accepted response MIME types. Example: `application/json` |

**Request body**

None.

**Response body**

The response body is a JSON object with the following structure:

### DeleteFileResponse JSON

| Name | Type | Description |
|------|------|-------------|
| `fileId` | string | The ID of the file. |
| `status` | string | The status of the delete operation. |

### JSON Example

```json
{
  "fileId": "string",
  "status": "string"
}
```

### Error Codes

| HTTP Status Code | Error Code | Description |
|------------------|------------|-------------|
| 400 | Bad Request | The request was malformed or invalid. |
| 401 | Unauthorized | Authentication failed or token is invalid. |
| 403 | Forbidden | The user does not have permission to access the resource. |
| 404 | Not Found | The requested resource was not found. |
| 500 | Internal Server Error | An unexpected error occurred on the server. |

---

## Page 12

### List Files

**Description:** Lists all files associated with a configuration.

**URL format:** `https://{hostname}/configurator/v4/configurations/{configurationId}/files`

**Method:** `GET`

**Resource URL parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `configurationId` | string | Yes | The ID of the configuration. |

**Request parameters**

None.

**Request headers**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `Authorization` | string | Yes | The OAuth 2.0 access token obtained using the client ID and secret. Example: `Bearer {token}` |
| `Accept` | string | Yes | The accepted response MIME types. Example: `application/json` |

**Request body**

None.

**Response body**

The response body is a JSON object with the following structure:

### ListFilesResponse JSON

| Name | Type | Description |
|------|------|-------------|
| `files` | array | A list of file objects. |

Each file object in the `files` array has the following structure:

### File JSON

| Name | Type | Description |
|------|------|-------------|
| `fileId` | string | The ID of the file. |
| `fileName` | string | The name of the file. |
| `fileSize` | integer | The size of the file in bytes. |
| `fileContentType` | string | The content type of the file. |

### JSON Example

```json
{
  "files": [
    {
      "fileId": "string",
      "fileName": "string",
      "fileSize": 0,
      "fileContentType": "string"
    }
  ]
}
```

### Error Codes

| HTTP Status Code | Error Code | Description |
|------------------|------------|-------------|
| 400 | Bad Request | The request was malformed or invalid. |
| 401 | Unauthorized | Authentication failed or token is invalid. |
| 403 | Forbidden | The user does not have permission to access the resource. |
| 404 | Not Found | The requested resource was not found. |
| 500 | Internal Server Error | An unexpected error occurred on the server. |

---

## Page 13

### List Files (continued)

**Description:** Lists all files associated with a configuration.

**URL format:** `https://{hostname}/configurator/v4/configurations/{configurationId}/files`

**Method:** `GET`

**Resource URL parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `configurationId` | string | Yes | The ID of the configuration. |

**Request parameters**

None.

**Request headers**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `Authorization` | string | Yes | The OAuth 2.0 access token obtained using the client ID and secret. Example: `Bearer {token}` |
| `Accept` | string | Yes | The accepted response MIME types. Example: `application/json` |

**Request body**

None.

**Response body**

The response body is a JSON object with the following structure:

### ListFilesResponse JSON

| Name | Type | Description |
|------|------|-------------|
| `files` | array | A list of file objects. |

Each file object in the `files` array has the following structure:

### File JSON

| Name | Type | Description |
|------|------|-------------|
| `fileId` | string | The ID of the file. |
| `fileName` | string | The name of the file. |
| `fileSize` | integer | The size of the file in bytes. |
| `fileContentType` | string | The content type of the file. |

### JSON Example

```json
{
  "files": [
    {
      "fileId": "string",
      "fileName": "string",
      "fileSize": 0,
      "fileContentType": "string"
    }
  ]
}
```

### Error Codes

| HTTP Status Code | Error Code | Description |
|------------------|------------|-------------|
| 400 | Bad Request | The request was malformed or invalid. |
| 401 | Unauthorized | Authentication failed or token is invalid. |
| 403 | Forbidden | The user does not have permission to access the resource. |
| 404 | Not Found | The requested resource was not found. |
| 500 | Internal Server Error | An unexpected error occurred on the server. |

---

## Page 14

### Batch Read Attributes

**Description:** Reads the values of multiple attributes in a configuration in a single request.

**URL format:** `https://{hostname}/configurator/v4/configurations/{configurationId}/attributes/batch-read`

**Method:** `POST`

**Resource URL parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `configurationId` | string | Yes | The ID of the configuration. |

**Request parameters**

None.

**Request headers**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `Authorization` | string | Yes | The OAuth 2.0 access token obtained using the client ID and secret. Example: `Bearer {token}` |
| `Content-Type` | string | Yes | The MIME type of the request body. Example: `application/json` |
| `Accept` | string | Yes | The accepted response MIME types. Example: `application/json` |

**Request body**

The request body is a JSON object with the following structure:

### BatchReadAttributes JSON

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `attributeIds` | array | Yes | A list of attribute IDs to read. |

### JSON Example

```json
{
  "attributeIds": [
    "string"
  ]
}
```

**Response body**

The response body is a JSON object with the following structure:

### BatchReadAttributesResponse JSON

| Name | Type | Description |
|------|------|-------------|
| `attributes` | array | A list of attribute objects. |

Each attribute object in the `attributes` array has the following structure:

### Attribute JSON

| Name | Type | Description |
|------|------|-------------|
| `attributeId` | string | The ID of the attribute. |
| `value` | string | The value of the attribute. |

### JSON Example

```json
{
  "attributes": [
    {
      "attributeId": "string",
      "value": "string"
    }
  ]
}
```

### Error Codes

| HTTP Status Code | Error Code | Description |
|------------------|------------|-------------|
| 400 | Bad Request | The request was malformed or invalid. |
| 401 | Unauthorized | Authentication failed or token is invalid. |
| 403 | Forbidden | The user does not have permission to access the resource. |
| 404 | Not Found | The requested resource was not found. |
| 500 | Internal Server Error | An unexpected error occurred on the server. |

---

*End of extraction (14 pages).*
