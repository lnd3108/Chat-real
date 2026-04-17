# 📚 HƯỚNG DẪN TÍCH HỢP GOOGLE LOGIN VỚI google-auth-library

> Tài liệu này hướng dẫn chi tiết cách tích hợp Google Login vào ứng dụng Web sử dụng:
> - **Backend**: Node.js + Express + MongoDB + JWT
> - **Frontend**: React + Redux
> - **Thư viện**: `google-auth-library` (Official Google Library)

---

## 📋 MỤC LỤC

1. [Tổng quan luồng hoạt động](#tổng-quan-luồng-hoạt-động)
2. [Chuẩn bị Google OAuth Credentials](#chuẩn-bị-google-oauth-credentials)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Implementation](#frontend-implementation)
5. [Testing & Debugging](#testing--debugging)
6. [FAQ & Troubleshooting](#faq--troubleshooting)

---

## 🔄 TỔNG QUAN LUỒNG HOẠT ĐỘNG

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│              │         │              │         │              │
│   FRONTEND   │────1───▶│    GOOGLE    │────2───▶│   FRONTEND   │
│              │         │              │         │              │
└──────────────┘         └──────────────┘         └──────────────┘
       │                                                  │
       │ 3. Send Google Token                            │
       │                                                  │
       ▼                                                  │
┌──────────────┐                                         │
│              │                                         │
│   BACKEND    │─────────4. Return JWT Tokens───────────┘
│              │
└──────────────┘
```

### Chi tiết các bước:

1. **Frontend hiển thị Google Sign-In button** → User click
2. **Google xác thực** → Trả về Google ID Token cho Frontend
3. **Frontend gửi Google Token** lên Backend API endpoint
4. **Backend verify token với Google** → Tạo/tìm user → Trả về JWT tokens
5. **Frontend lưu JWT** và redirect user vào app

---

## 🔑 CHUẨN BỊ GOOGLE OAUTH CREDENTIALS

### Bước 1: Truy cập Google Cloud Console

1. Vào https://console.cloud.google.com/
2. Đăng nhập bằng tài khoản Google

### Bước 2: Tạo hoặc chọn Project

1. Click vào dropdown project ở góc trên bên trái
2. Click **"NEW PROJECT"**
3. Nhập tên project (VD: `my-app-oauth`)
4. Click **"CREATE"**

### Bước 3: Enable Google+ API (Optional nhưng recommended)

1. Vào **"APIs & Services"** → **"Library"**
2. Tìm **"Google+ API"**
3. Click **"Enable"**

### Bước 4: Tạo OAuth 2.0 Credentials

1. Vào **"APIs & Services"** → **"Credentials"**
2. Click **"CREATE CREDENTIALS"** → **"OAuth client ID"**
3. Nếu chưa có OAuth consent screen, click **"CONFIGURE CONSENT SCREEN"**:
   - Chọn **"External"** (nếu app public) hoặc **"Internal"**
   - Nhập **App name**, **User support email**, **Developer contact**
   - Click **"SAVE AND CONTINUE"** → **"SAVE AND CONTINUE"** → **"BACK TO DASHBOARD"**

4. Quay lại **"CREATE CREDENTIALS"** → **"OAuth client ID"**:
   - Application type: **"Web application"**
   - Name: `My Web App OAuth Client`
   - **Authorized JavaScript origins**:
     ```
     http://localhost:5173
     https://yourdomain.com
     ```
   - **Authorized redirect URIs**: (Để trống nếu dùng google-auth-library)
   - Click **"CREATE"**

5. **Lưu lại**:
   - ✅ **Client ID**: `123456789-abcdefg.apps.googleusercontent.com`
   - ⚠️ **Client Secret**: (Không cần thiết cho cách này, nhưng nên lưu)

### Bước 5: Test Domain (Production)

Khi deploy production, thêm domain vào:
- **Authorized JavaScript origins**: `https://your-production-domain.com`

---

## 💻 BACKEND IMPLEMENTATION

### BƯỚC 1: Cài đặt Dependencies

```bash
cd your-backend-folder
npm install google-auth-library
# hoặc
yarn add google-auth-library
```

### BƯỚC 2: Cấu hình Environment Variables

**File: `.env`**

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com

# Existing variables
MONGODB_URI=...
ACCESS_TOKEN_SECRET_SIGNATURE=...
REFRESH_TOKEN_SECRET_SIGNATURE=...
ACCESS_TOKEN_LIFE=1h
REFRESH_TOKEN_LIFE=14d
```

**File: `src/config/environment.js`** (Nếu có file config riêng)

```javascript
export const env = {
  // ... existing configs
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
}
```

### BƯỚC 3: Tạo Google Provider

**File: `src/providers/GoogleProvider.js`**

```javascript
import { OAuth2Client } from 'google-auth-library'
import { env } from '~/config/environment'

// Khởi tạo Google OAuth Client
const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID)

/**
 * Verify Google ID Token
 * @param {string} token - Google ID Token nhận từ Frontend
 * @returns {Object} - User profile từ Google
 */
const verifyGoogleToken = async (token) => {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: env.GOOGLE_CLIENT_ID // Client ID của app
    })
    
    // Lấy payload (thông tin user)
    const payload = ticket.getPayload()
    
    /**
     * payload contains:
     * - sub: Google user ID (unique)
     * - email: User email
     * - email_verified: Boolean
     * - name: Full name
     * - picture: Avatar URL
     * - given_name: First name
     * - family_name: Last name
     * - locale: Language preference
     */
    
    return {
      googleId: payload.sub,
      email: payload.email,
      displayName: payload.name,
      avatar: payload.picture,
      isVerified: payload.email_verified,
      firstName: payload.given_name,
      lastName: payload.family_name
    }
  } catch (error) {
    throw new Error('Invalid Google token')
  }
}

export const GoogleProvider = {
  verifyGoogleToken
}
```

### BƯỚC 4: Cập nhật User Model

**File: `src/models/userModel.js`**

```javascript
import Joi from 'joi'
import { ObjectId } from 'mongodb'
import { GET_DB } from '~/config/mongodb'
import { EMAIL_RULE, EMAIL_RULE_MESSAGE } from '~/utils/validators'

const USER_ROLES = {
  CLIENT: 'client',
  ADMIN: 'admin'
}

const USER_COLLECTION_NAME = 'users'
const USER_COLLECTION_SCHEMA = Joi.object({
  email: Joi.string().required().pattern(EMAIL_RULE).message(EMAIL_RULE_MESSAGE),
  
  // Password: Required nếu authType = 'local', optional nếu authType = 'google'
  password: Joi.string().when('authType', {
    is: 'local',
    then: Joi.required(),
    otherwise: Joi.optional().allow(null)
  }),
  
  username: Joi.string().required().trim().strict(),
  displayName: Joi.string().required().trim().strict(),
  avatar: Joi.string().default(null),
  role: Joi.string().valid(...Object.values(USER_ROLES)).default(USER_ROLES.CLIENT),
  
  // Google Login fields
  googleId: Joi.string().default(null), // Google unique user ID
  authType: Joi.string().valid('local', 'google').default('local'), // Loại đăng nhập
  
  isActive: Joi.boolean().default(false),
  verifyToken: Joi.string().allow(null),
  
  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

// ... existing code ...

/**
 * Tìm user theo Google ID
 */
const findOneByGoogleId = async (googleId) => {
  try {
    const result = await GET_DB().collection(USER_COLLECTION_NAME).findOne({ 
      googleId: googleId 
    })
    return result
  } catch (error) { 
    throw new Error(error) 
  }
}

// ... existing functions ...

export const userModel = {
  USER_COLLECTION_NAME,
  USER_COLLECTION_SCHEMA,
  USER_ROLES,
  createNew,
  findOneById,
  findOneByEmail,
  findOneByGoogleId, // ⭐ Thêm function mới
  update
}
```

### BƯỚC 5: Tạo Service Logic

**File: `src/services/userService.js`**

Thêm function `loginWithGoogle`:

```javascript
import { userModel } from '~/models/userModel'
import ApiError from '~/utils/ApiError'
import { StatusCodes } from 'http-status-codes'
import { pickUser } from '~/utils/formatters'
import { jwtProvider } from '~/providers/JwtProvider'
import { GoogleProvider } from '~/providers/GoogleProvider' // ⭐ Import
import { env } from '~/config/environment'

// ... existing functions ...

/**
 * Login với Google Account
 * @param {string} googleToken - Google ID Token từ Frontend
 */
const loginWithGoogle = async (googleToken) => {
  try {
    // BƯỚC 1: Verify token với Google
    const googleProfile = await GoogleProvider.verifyGoogleToken(googleToken)
    
    // Kiểm tra email đã được Google verify chưa
    if (!googleProfile.isVerified) {
      throw new ApiError(
        StatusCodes.FORBIDDEN, 
        'Email chưa được Google xác thực'
      )
    }

    // BƯỚC 2: Tìm user trong database
    // Ưu tiên tìm theo googleId trước
    let existUser = await userModel.findOneByGoogleId(googleProfile.googleId)
    
    // Nếu không có, tìm theo email
    if (!existUser) {
      existUser = await userModel.findOneByEmail(googleProfile.email)
    }

    // BƯỚC 3: Xử lý user
    if (!existUser) {
      // Trường hợp 1: User chưa tồn tại → Tạo mới
      const nameFromEmail = googleProfile.email.split('@')[0]
      const newUser = {
        email: googleProfile.email,
        username: nameFromEmail,
        displayName: googleProfile.displayName || nameFromEmail,
        avatar: googleProfile.avatar,
        googleId: googleProfile.googleId,
        authType: 'google',
        isActive: true, // ⭐ Auto active vì Google đã verify email
        verifyToken: null, // Không cần verify token
        password: null // Không có password khi đăng nhập Google
      }
      
      const createdUser = await userModel.createNew(newUser)
      existUser = await userModel.findOneById(createdUser.insertedId)
      
    } else if (!existUser.googleId) {
      // Trường hợp 2: User đã tồn tại (đăng ký bằng email/password)
      // nhưng chưa liên kết Google → Update thêm googleId
      const updateData = {
        googleId: googleProfile.googleId,
        isActive: true, // Kích hoạt luôn nếu chưa active
        avatar: existUser.avatar || googleProfile.avatar // Update avatar nếu chưa có
      }
      
      await userModel.update(existUser._id, updateData)
      existUser = await userModel.findOneById(existUser._id)
    }
    // Trường hợp 3: User đã có googleId → Chỉ cần login

    // BƯỚC 4: Tạo JWT Tokens
    const userInfo = { 
      _id: existUser._id, 
      email: existUser.email 
    }
    
    const accessToken = await jwtProvider.generateToken(
      userInfo,
      env.ACCESS_TOKEN_SECRET_SIGNATURE,
      env.ACCESS_TOKEN_LIFE
    )

    const refreshToken = await jwtProvider.generateToken(
      userInfo,
      env.REFRESH_TOKEN_SECRET_SIGNATURE,
      env.REFRESH_TOKEN_LIFE
    )

    // BƯỚC 5: Trả về kết quả
    return { 
      accessToken, 
      refreshToken, 
      ...pickUser(existUser) 
    }
    
  } catch (error) { 
    throw error 
  }
}

export const userService = {
  createNew,
  verifyAccount,
  login,
  loginWithGoogle, // ⭐ Export function mới
  logout,
  refreshToken,
  update
}
```

### BƯỚC 6: Tạo Controller

**File: `src/controllers/userController.js`**

Thêm controller `loginWithGoogle`:

```javascript
import { StatusCodes } from 'http-status-codes'
import ms from 'ms'
import { userService } from '~/services/userService'
import ApiError from '~/utils/ApiError'

// ... existing controllers ...

/**
 * Controller xử lý Google Login
 */
const loginWithGoogle = async (req, res, next) => {
  try {
    const { googleToken } = req.body
    
    // Validate input
    if (!googleToken) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Google token is required')
    }
    
    // Gọi service xử lý logic
    const result = await userService.loginWithGoogle(googleToken)

    // Set HTTP-only cookies (giống login thường)
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: ms('14d')
    })

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: ms('14d')
    })

    // Trả về response
    res.status(StatusCodes.OK).json(result)
    
  } catch (error) { 
    next(error) 
  }
}

export const userController = {
  createNew,
  verifyAccount,
  login,
  loginWithGoogle, // ⭐ Export controller mới
  logout,
  refreshToken,
  update
}
```

### BƯỚC 7: Tạo Route

**File: `src/routes/v1/userRoute.js`**

Thêm route mới:

```javascript
import express from 'express'
import { userValidation } from '~/validations/userValidation'
import { userController } from '~/controllers/userController'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { multerUploadMiddleware } from '~/middlewares/multerUploadMiddleware'

const Router = express.Router()

// Existing routes
Router.route('/register')
  .post(userValidation.createNew, userController.createNew)

Router.route('/verify')
  .put(userValidation.verifyAccount, userController.verifyAccount)

Router.route('/login')
  .put(userValidation.login, userController.login)

// ⭐ NEW: Google Login Route
Router.route('/google-login')
  .post(userController.loginWithGoogle)

Router.route('/logout')
  .delete(userController.logout)

Router.route('/refresh_token')
  .get(userController.refreshToken)

Router.route('/update')
  .put(
    authMiddleware.isAuthorized,
    multerUploadMiddleware.upload.single('avatar'),
    userValidation.update,
    userController.update
  )

export const userRoute = Router
```

### BƯỚC 8: Validation (Optional nhưng recommended)

**File: `src/validations/userValidation.js`**

Thêm validation cho Google login:

```javascript
import Joi from 'joi'
import { StatusCodes } from 'http-status-codes'
import ApiError from '~/utils/ApiError'

// ... existing validations ...

const loginWithGoogle = async (req, res, next) => {
  const correctCondition = Joi.object({
    googleToken: Joi.string().required().trim().strict()
  })
  
  try {
    await correctCondition.validateAsync(req.body, { abortEarly: false })
    next()
  } catch (error) {
    next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, new Error(error).message))
  }
}

export const userValidation = {
  createNew,
  verifyAccount,
  login,
  loginWithGoogle, // ⭐ Export validation mới
  update
}
```

Cập nhật route nếu dùng validation:

```javascript
Router.route('/google-login')
  .post(userValidation.loginWithGoogle, userController.loginWithGoogle)
```

---

## 🎨 FRONTEND IMPLEMENTATION

### BƯỚC 1: Thêm Google Sign-In Script

**File: `index.html`**

Thêm script Google vào trong `<head>` hoặc trước `</body>`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Your App</title>
    
    <!-- ⭐ Google Sign-In Script -->
    <script src="https://accounts.google.com/gsi/client" async defer></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

### BƯỚC 2: Cấu hình Environment Variables

**File: `.env`**

```env
VITE_API_URL=http://localhost:8017
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

**Lưu ý**: 
- Với Vite, biến phải có prefix `VITE_`
- Với Create React App, dùng prefix `REACT_APP_`

### BƯỚC 3: Tạo Google Login Button Component

**File: `src/components/Auth/GoogleLoginButton.jsx`**

```jsx
import { useEffect, useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import { toast } from 'react-toastify'
import { loginWithGoogleAPI } from '~/redux/user/userSlice'

function GoogleLoginButton() {
  const dispatch = useDispatch()
  const navigate = useNavigate()

  /**
   * Callback được gọi khi user đăng nhập Google thành công
   * @param {Object} response - Response từ Google chứa credential (ID Token)
   */
  const handleGoogleResponse = useCallback(async (response) => {
    try {
      if (response.credential) {
        // response.credential chính là Google ID Token
        const toastId = toast.loading('Đang đăng nhập với Google...')
        
        const result = await dispatch(loginWithGoogleAPI({ 
          googleToken: response.credential 
        }))
        
        toast.dismiss(toastId)
        
        if (!result.error) {
          toast.success('Đăng nhập thành công!')
          navigate('/')
        } else {
          const errorMessage = result.error?.message || 'Đăng nhập thất bại'
          toast.error(errorMessage)
        }
      }
    } catch (error) {
      console.error('Google login error:', error)
      toast.error('Có lỗi xảy ra khi đăng nhập với Google')
    }
  }, [dispatch, navigate])

  useEffect(() => {
    // Kiểm tra xem Google Sign-In SDK đã load chưa
    if (window.google) {
      // Initialize Google Sign-In
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
        auto_select: false, // Không tự động chọn account
        cancel_on_tap_outside: true // Đóng popup khi click bên ngoài
      })

      // Render nút Google Sign-In
      window.google.accounts.id.renderButton(
        document.getElementById('google-signin-button'),
        {
          theme: 'outline', // 'outline' | 'filled_blue' | 'filled_black'
          size: 'large', // 'large' | 'medium' | 'small'
          width: 380, // Width của button (px)
          text: 'signin_with', // Text hiển thị
          // Các options khác:
          // text: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
          shape: 'rectangular', // 'rectangular' | 'pill' | 'circle' | 'square'
          logo_alignment: 'left', // 'left' | 'center'
          locale: 'vi' // Ngôn ngữ: 'vi', 'en', etc.
        }
      )

      // Optional: Hiển thị One Tap prompt (popup tự động)
      // window.google.accounts.id.prompt()
    }
  }, [handleGoogleResponse])

  return (
    <Box 
      sx={{ 
        mt: 2, 
        mb: 2,
        display: 'flex',
        justifyContent: 'center'
      }}
    >
      {/* Google sẽ render button vào div này */}
      <div id="google-signin-button"></div>
    </Box>
  )
}

export default GoogleLoginButton
```

**Tùy chỉnh button appearance:**

```javascript
// Các options cho renderButton:
{
  type: 'standard',        // 'standard' | 'icon'
  theme: 'outline',        // 'outline' | 'filled_blue' | 'filled_black'
  size: 'large',          // 'large' | 'medium' | 'small'
  text: 'signin_with',    // 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape: 'rectangular',   // 'rectangular' | 'pill' | 'circle' | 'square'
  logo_alignment: 'left', // 'left' | 'center'
  width: 380,            // Width tùy chỉnh (pixels)
  locale: 'vi'           // Ngôn ngữ
}
```

### BƯỚC 4: Cập nhật Redux Slice

**File: `src/redux/user/userSlice.js`**

```javascript
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import authorizedAxiosInstance from '~/utils/authorizeAxios'
import { toast } from 'react-toastify'

// ... existing code ...

// ⭐ Thêm async thunk mới cho Google Login
export const loginWithGoogleAPI = createAsyncThunk(
  'user/loginWithGoogle',
  async (data, { rejectWithValue }) => {
    try {
      const response = await authorizedAxiosInstance.post(
        '/v1/users/google-login', 
        data
      )
      return response.data
    } catch (error) {
      // Xử lý error từ backend
      const message = error.response?.data?.message || error.message
      toast.error(message)
      return rejectWithValue(error.response?.data)
    }
  }
)

// Existing thunks
export const loginUserAPI = createAsyncThunk(...)
export const logoutUserAPI = createAsyncThunk(...)

// Slice
const userSlice = createSlice({
  name: 'user',
  initialState: {
    currentUser: null,
    loading: false,
    error: null
  },
  reducers: {
    // ... existing reducers
  },
  extraReducers: (builder) => {
    builder
      // Existing cases cho login thường
      .addCase(loginUserAPI.fulfilled, (state, action) => {
        state.currentUser = action.payload
        state.loading = false
      })
      
      // ⭐ Thêm cases cho Google Login
      .addCase(loginWithGoogleAPI.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(loginWithGoogleAPI.fulfilled, (state, action) => {
        state.currentUser = action.payload
        state.loading = false
        state.error = null
      })
      .addCase(loginWithGoogleAPI.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // ... other cases
  }
})

export const selectCurrentUser = (state) => state.user.currentUser
export const selectUserLoading = (state) => state.user.loading

export default userSlice.reducer
```

### BƯỚC 5: Tích hợp vào Login Form

**File: `src/pages/Auth/LoginForm.jsx`**

```jsx
import { Link } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { Card as MuiCard } from '@mui/material'
import TextField from '@mui/material/TextField'
import Divider from '@mui/material/Divider'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { loginUserAPI } from '~/redux/user/userSlice'
import { toast } from 'react-toastify'

// ⭐ Import Google Login Button
import GoogleLoginButton from '~/components/Auth/GoogleLoginButton'

import {
  EMAIL_RULE,
  PASSWORD_RULE,
  FIELD_REQUIRED_MESSAGE,
  PASSWORD_RULE_MESSAGE,
  EMAIL_RULE_MESSAGE
} from '~/utils/validators'
import FieldErrorAlert from '~/components/Form/FieldErrorAlert'

function LoginForm() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm()

  const submitLogIn = (data) => {
    const { email, password } = data
    toast.promise(dispatch(loginUserAPI({ email, password })), {
      pending: 'Logging in...'
    }).then(res => {
      if (!res.error) {
        navigate('/')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(submitLogIn)}>
      <MuiCard sx={{ minWidth: 380, maxWidth: 380, marginTop: '6em' }}>
        
        {/* Header */}
        <Box sx={{ padding: '2em 2em 0 2em', textAlign: 'center' }}>
          <Typography variant="h5" fontWeight="bold">
            Đăng Nhập
          </Typography>
        </Box>

        {/* ⭐ Google Login Button */}
        <Box sx={{ padding: '0 2em' }}>
          <GoogleLoginButton />
        </Box>

        {/* ⭐ Divider */}
        <Box sx={{ padding: '0 2em' }}>
          <Divider sx={{ my: 2 }}>
            <Typography variant="body2" color="text.secondary">
              HOẶC
            </Typography>
          </Divider>
        </Box>

        {/* Email/Password Form */}
        <Box sx={{ padding: '0 2em 2em 2em' }}>
          {/* Email Field */}
          <Box sx={{ marginTop: '1em' }}>
            <TextField
              autoFocus
              fullWidth
              label="Email"
              type="text"
              variant="outlined"
              error={!!errors['email']}
              {...register('email', {
                required: FIELD_REQUIRED_MESSAGE,
                pattern: {
                  value: EMAIL_RULE,
                  message: EMAIL_RULE_MESSAGE
                }
              })}
            />
            <FieldErrorAlert errors={errors} fieldName={'email'} />
          </Box>

          {/* Password Field */}
          <Box sx={{ marginTop: '1em' }}>
            <TextField
              fullWidth
              label="Password"
              type="password"
              variant="outlined"
              error={!!errors['password']}
              {...register('password', {
                required: FIELD_REQUIRED_MESSAGE,
                pattern: {
                  value: PASSWORD_RULE,
                  message: PASSWORD_RULE_MESSAGE
                }
              })}
            />
            <FieldErrorAlert errors={errors} fieldName={'password'} />
          </Box>

          {/* Login Button */}
          <Box sx={{ marginTop: '1em' }}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              size="large"
            >
              Đăng Nhập
            </Button>
          </Box>

          {/* Register Link */}
          <Box sx={{ marginTop: '1em', textAlign: 'center' }}>
            <Typography variant="body2">
              Chưa có tài khoản?{' '}
              <Link to="/register" style={{ textDecoration: 'none' }}>
                Đăng ký ngay
              </Link>
            </Typography>
          </Box>
        </Box>
      </MuiCard>
    </form>
  )
}

export default LoginForm
```

### BƯỚC 6: Optional - Tích hợp vào Register Form

Bạn cũng có thể thêm Google Sign-In vào trang đăng ký tương tự:

```jsx
// src/pages/Auth/RegisterForm.jsx
import GoogleLoginButton from '~/components/Auth/GoogleLoginButton'

// Trong component:
<GoogleLoginButton />
<Divider sx={{ my: 2 }}>
  <Typography variant="body2" color="text.secondary">
    HOẶC ĐĂNG KÝ BẰNG EMAIL
  </Typography>
</Divider>
```

---

## 🧪 TESTING & DEBUGGING

### Test Flow

1. **Khởi động Backend:**
   ```bash
   cd trello-api
   npm run dev
   # hoặc yarn dev
   ```

2. **Khởi động Frontend:**
   ```bash
   cd trello-web
   npm run dev
   # hoặc yarn dev
   ```

3. **Test Google Login:**
   - Vào trang Login
   - Click nút "Sign in with Google"
   - Chọn tài khoản Google
   - Kiểm tra console logs
   - Xác nhận redirect về trang chủ

### Debug Checklist

✅ **Backend:**

```javascript
// Trong GoogleProvider.js
const verifyGoogleToken = async (token) => {
  try {
    console.log('🔍 Verifying token:', token.substring(0, 20) + '...')
    const ticket = await googleClient.verifyIdToken({...})
    const payload = ticket.getPayload()
    console.log('✅ Token verified. User:', payload.email)
    return {...}
  } catch (error) {
    console.error('❌ Token verification failed:', error.message)
    throw new Error('Invalid Google token')
  }
}

// Trong userService.js
const loginWithGoogle = async (googleToken) => {
  console.log('📝 Login with Google started')
  const googleProfile = await GoogleProvider.verifyGoogleToken(googleToken)
  console.log('👤 Google Profile:', googleProfile)
  // ... rest of code
  console.log('✅ Login successful:', pickUser(existUser))
  return {...}
}
```

✅ **Frontend:**

```javascript
// Trong GoogleLoginButton.jsx
const handleGoogleResponse = useCallback(async (response) => {
  console.log('🔐 Google Response:', response)
  console.log('🎫 Token:', response.credential?.substring(0, 20) + '...')
  
  const result = await dispatch(loginWithGoogleAPI({ 
    googleToken: response.credential 
  }))
  
  console.log('📨 Backend Response:', result)
}, [dispatch, navigate])
```

### Common Errors & Solutions

#### ❌ Error: "Invalid Google token"

**Nguyên nhân:**
- Client ID không khớp
- Token đã expired
- Token bị modify

**Giải pháp:**
```javascript
// Kiểm tra CLIENT_ID
console.log('Backend GOOGLE_CLIENT_ID:', env.GOOGLE_CLIENT_ID)
console.log('Frontend GOOGLE_CLIENT_ID:', import.meta.env.VITE_GOOGLE_CLIENT_ID)
// Phải giống nhau!
```

#### ❌ Error: "Google Sign-In button not showing"

**Nguyên nhân:**
- Script chưa load
- Element ID không đúng
- Client ID sai

**Giải pháp:**
```javascript
useEffect(() => {
  // Đợi script load xong
  const checkGoogle = setInterval(() => {
    if (window.google) {
      clearInterval(checkGoogle)
      console.log('✅ Google SDK loaded')
      window.google.accounts.id.initialize({...})
    }
  }, 100)
  
  return () => clearInterval(checkGoogle)
}, [])
```

#### ❌ Error: "Unauthorized JavaScript origin"

**Nguyên nhân:**
- Origin chưa được add vào Google Console

**Giải pháp:**
1. Vào Google Cloud Console
2. Credentials → OAuth 2.0 Client IDs
3. Thêm `http://localhost:5173` vào **Authorized JavaScript origins**

#### ❌ CORS Error

**Giải pháp Backend:**
```javascript
// src/config/cors.js
export const corsOptions = {
  origin: function (origin, callback) {
    // Cho phép localhost và production domain
    const whitelist = [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://yourdomain.com'
    ]
    
    if (!origin || whitelist.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true // Quan trọng cho cookie
}
```

---

## 🔒 BEST PRACTICES & SECURITY

### 1. Validate Token ở Backend

**❌ ĐỪNG LÀM:**
```javascript
// Tin tưởng data từ frontend
const loginWithGoogle = async (userData) => {
  // Nguy hiểm! Frontend có thể giả mạo data
  const user = await userModel.createNew(userData)
}
```

**✅ NÊN LÀM:**
```javascript
// Verify token với Google trước
const loginWithGoogle = async (googleToken) => {
  const googleProfile = await GoogleProvider.verifyGoogleToken(googleToken)
  // Chỉ tin data từ Google
}
```

### 2. Bảo vệ Client ID

**Frontend (.env):**
```env
# OK - Client ID công khai được
VITE_GOOGLE_CLIENT_ID=123456.apps.googleusercontent.com
```

**Backend (.env):**
```env
# QUAN TRỌNG - Giữ bí mật!
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx
```

**⚠️ Lưu ý:**
- Client ID: Công khai OK
- Client Secret: TUYỆT ĐỐI GIỮ BÍ MẬT (không cần cho cách này)

### 3. Handle Account Merging

```javascript
// userService.js
const loginWithGoogle = async (googleToken) => {
  const googleProfile = await GoogleProvider.verifyGoogleToken(googleToken)
  let existUser = await userModel.findOneByEmail(googleProfile.email)
  
  if (existUser) {
    // User đã đăng ký bằng email/password trước đó
    if (!existUser.googleId) {
      // Hỏi user xác nhận merge account
      // Hoặc tự động merge nếu email đã verified
      await userModel.update(existUser._id, {
        googleId: googleProfile.googleId
      })
    }
  }
}
```

### 4. Rate Limiting

```javascript
// Cài express-rate-limit
import rateLimit from 'express-rate-limit'

const googleLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10, // Max 10 requests
  message: 'Too many login attempts, please try again later'
})

// Apply vào route
Router.route('/google-login')
  .post(googleLoginLimiter, userController.loginWithGoogle)
```

### 5. Logging & Monitoring

```javascript
const loginWithGoogle = async (googleToken) => {
  try {
    const googleProfile = await GoogleProvider.verifyGoogleToken(googleToken)
    
    // Log cho monitoring
    console.log({
      action: 'GOOGLE_LOGIN_ATTEMPT',
      email: googleProfile.email,
      timestamp: new Date().toISOString()
    })
    
    // ... xử lý login
    
    console.log({
      action: 'GOOGLE_LOGIN_SUCCESS',
      userId: existUser._id,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error({
      action: 'GOOGLE_LOGIN_FAILED',
      error: error.message,
      timestamp: new Date().toISOString()
    })
    throw error
  }
}
```

---

## 📱 RESPONSIVE & UX IMPROVEMENTS

### 1. Loading State

```jsx
function GoogleLoginButton() {
  const [isLoading, setIsLoading] = useState(false)

  const handleGoogleResponse = useCallback(async (response) => {
    setIsLoading(true)
    try {
      // ... login logic
    } finally {
      setIsLoading(false)
    }
  }, [])

  return (
    <Box sx={{ position: 'relative' }}>
      <div id="google-signin-button"></div>
      {isLoading && (
        <Box sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.8)'
        }}>
          <CircularProgress size={24} />
        </Box>
      )}
    </Box>
  )
}
```

### 2. Error Handling

```jsx
const handleGoogleResponse = useCallback(async (response) => {
  try {
    if (response.error) {
      // User đóng popup hoặc từ chối
      if (response.error === 'popup_closed_by_user') {
        toast.info('Đăng nhập đã bị hủy')
        return
      }
      throw new Error(response.error)
    }
    
    if (!response.credential) {
      throw new Error('Không nhận được token từ Google')
    }
    
    // ... login logic
    
  } catch (error) {
    // Hiển thị error message thân thiện
    const userFriendlyMessage = {
      'Invalid Google token': 'Token không hợp lệ, vui lòng thử lại',
      'Email chưa được Google xác thực': 'Email chưa được xác thực',
      'Network Error': 'Lỗi kết nối, kiểm tra internet'
    }
    
    const message = userFriendlyMessage[error.message] || 
                   'Có lỗi xảy ra, vui lòng thử lại'
    toast.error(message)
  }
}, [dispatch, navigate])
```

### 3. Mobile Optimization

```jsx
// Tự động điều chỉnh width theo màn hình
useEffect(() => {
  if (window.google) {
    const buttonWidth = window.innerWidth > 400 ? 380 : window.innerWidth - 40
    
    window.google.accounts.id.renderButton(
      document.getElementById('google-signin-button'),
      {
        theme: 'outline',
        size: 'large',
        width: buttonWidth, // Dynamic width
        text: 'signin_with',
        shape: 'rectangular',
        locale: 'vi'
      }
    )
  }
}, [handleGoogleResponse])
```

---

## 🚀 DEPLOYMENT

### Production Environment Variables

**Backend (.env.production):**
```env
NODE_ENV=production
GOOGLE_CLIENT_ID=your_production_client_id.apps.googleusercontent.com
FRONTEND_URL=https://yourdomain.com
```

**Frontend (.env.production):**
```env
VITE_API_URL=https://api.yourdomain.com
VITE_GOOGLE_CLIENT_ID=your_production_client_id.apps.googleusercontent.com
```

### Google Console Production Setup

1. **Thêm Production Domain:**
   - Authorized JavaScript origins: `https://yourdomain.com`
   - Authorized redirect URIs: (Không cần cho google-auth-library)

2. **Verify Domain:**
   - Google Console → Domain verification
   - Thêm TXT record vào DNS

3. **OAuth Consent Screen:**
   - Publishing status: **Production** (sau khi verify)
   - Privacy Policy URL
   - Terms of Service URL

### HTTPS Requirement

⚠️ **Google yêu cầu HTTPS trên production!**

```javascript
// Backend: Enforce HTTPS
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    return res.redirect('https://' + req.headers.host + req.url)
  }
  next()
})

// Cookie settings cho production
res.cookie('accessToken', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // true on prod
  sameSite: 'none',
  maxAge: ms('14d')
})
```

---

## ❓ FAQ & TROUBLESHOOTING

### Q1: Có thể dùng cả Email/Password và Google Login không?

**A:** Có! User model đã support cả 2 cách:
```javascript
{
  email: "user@example.com",
  password: "hashed_password", // Có nếu đăng ký bằng email
  googleId: "123456789",       // Có nếu đăng nhập Google
  authType: "local"            // hoặc "google"
}
```

### Q2: User đăng ký email trước, sau đó login Google với cùng email?

**A:** Code đã xử lý tự động merge:
```javascript
if (existUser && !existUser.googleId) {
  // Update thêm googleId vào account hiện có
  await userModel.update(existUser._id, {
    googleId: googleProfile.googleId
  })
}
```

### Q3: User Google Login không có password, làm sao change password?

**A:** Tạo feature "Set Password" cho user:
```javascript
const setPassword = async (userId, newPassword) => {
  const user = await userModel.findOneById(userId)
  
  if (user.authType === 'google' && !user.password) {
    // Cho phép set password lần đầu
    const hashedPassword = await bcrypt.hash(newPassword, 8)
    await userModel.update(userId, {
      password: hashedPassword,
      authType: 'local' // hoặc giữ 'google'
    })
  }
}
```

### Q4: Test Google Login ở localhost?

**A:** Có thể! Thêm `http://localhost:PORT` vào Authorized JavaScript origins.

### Q5: Google button không hiển thị?

**Check list:**
1. ✅ Script đã load? `console.log(window.google)`
2. ✅ Client ID đúng?
3. ✅ Element ID đúng? (`google-signin-button`)
4. ✅ Origin đã được authorize?

### Q6: Token expired error?

**A:** Google ID Token có thời gian sống ~1 giờ. Frontend nên:
1. Gửi token ngay sau khi nhận
2. Không lưu token vào localStorage
3. Backend verify ngay lập tức

### Q7: Production khác localhost như thế nào?

**Khác biệt chính:**
- HTTPS required (production)
- Different Client ID có thể (recommended)
- Domain phải verified
- OAuth Consent Screen phải publish

---

## 📚 TÀI LIỆU THAM KHẢO

### Official Documentation

- **Google Identity**: https://developers.google.com/identity/gsi/web
- **google-auth-library**: https://github.com/googleapis/google-auth-library-nodejs
- **OAuth 2.0**: https://developers.google.com/identity/protocols/oauth2

### Code Examples

- **Google Sign-In Web**: https://developers.google.com/identity/gsi/web/guides/overview
- **Token Verification**: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token

### Best Practices

- **Security**: https://developers.google.com/identity/protocols/oauth2/web-server#security-considerations
- **UX Guidelines**: https://developers.google.com/identity/branding-guidelines

---

## 🎯 CHECKLIST HOÀN THÀNH

### Backend:
- [ ] Cài `google-auth-library`
- [ ] Tạo `GoogleProvider.js`
- [ ] Update `userModel.js` (googleId, authType)
- [ ] Thêm `findOneByGoogleId()` vào model
- [ ] Tạo `loginWithGoogle()` service
- [ ] Tạo `loginWithGoogle()` controller
- [ ] Thêm route `/google-login`
- [ ] Thêm `GOOGLE_CLIENT_ID` vào .env
- [ ] Test API với Postman/Thunder Client

### Frontend:
- [ ] Thêm Google script vào `index.html`
- [ ] Tạo `GoogleLoginButton.jsx`
- [ ] Thêm `loginWithGoogleAPI` vào Redux
- [ ] Update `LoginForm.jsx`
- [ ] Thêm `VITE_GOOGLE_CLIENT_ID` vào .env
- [ ] Test flow hoàn chỉnh

### Google Console:
- [ ] Tạo OAuth Client ID
- [ ] Configure Consent Screen
- [ ] Thêm Authorized JavaScript origins
- [ ] Copy Client ID
- [ ] Test với localhost

### Testing:
- [ ] Click Google button hiển thị popup
- [ ] Chọn account Google thành công
- [ ] Backend nhận và verify token
- [ ] Tạo user mới (lần đầu)
- [ ] Login user existing (lần sau)
- [ ] JWT tokens được set vào cookie
- [ ] Redirect về trang chủ
- [ ] User state trong Redux updated

---

## 📝 KẾT LUẬN

Bạn đã có đầy đủ kiến thức để implement Google Login vào bất kỳ dự án nào! 

**Key Takeaways:**
- ✅ Sử dụng `google-auth-library` đơn giản hơn Passport
- ✅ Frontend tự xử lý Google Sign-In UI
- ✅ Backend chỉ verify token và tạo JWT
- ✅ Support cả Email/Password và Google Login
- ✅ Tự động merge accounts khi trùng email

**Lưu ý quan trọng:**
- 🔒 Luôn verify token ở Backend
- 🚫 Không tin tưởng data từ Frontend
- ✅ Handle errors gracefully
- 📱 Test trên nhiều devices
- 🔐 Bảo mật Client Secret (nếu dùng)

Chúc bạn implement thành công! 🎉
