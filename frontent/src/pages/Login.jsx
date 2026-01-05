import { useState } from 'react';
import {
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Stack,
  useToast,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    console.log(loading)
    try {
      // Simple admin login: just send username and password
      const response = await authAPI.login({
        username: username,
        password: password,
      });

      // Store the real JWT token from backend
      if (response.token) {
        localStorage.setItem('token', response.token);
        localStorage.setItem('adminToken', response.token);
        localStorage.setItem('adminUser', JSON.stringify(response.user));
        
        console.log('✅ [Login] Token stored:', response.token.substring(0, 20) + '...');
        
        toast({
          title: 'تم تسجيل الدخول بنجاح',
          description: `مرحباً بك ${response.user.fullName || response.user.email}`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        navigate('/dashboard');
      } else {
        throw new Error('لم يتم استلام رمز الدخول من الخادم');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: 'خطأ في تسجيل الدخول',
        description: error.message || 'اسم المستخدم أو كلمة المرور غير صحيحة',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      minH="100vh"
      bg="gray.50"
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <Container maxW="md">
        <VStack spacing={8}>
          <VStack spacing={2}>
            <Heading size="xl" color="blue.600">
              Admin Panel
            </Heading>
            <Text color="gray.600">نظام إدارة الحضور</Text>
          </VStack>

          <Box
            bg="white"
            p={8}
            borderRadius="lg"
            boxShadow="lg"
            width="100%"
          >
            <form onSubmit={handleLogin}>
              <Stack spacing={4}>
                <FormControl isRequired>
                  <FormLabel>اسم المستخدم</FormLabel>
                  <Input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder=""
                    size="lg"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>كلمة المرور</FormLabel>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder=""
                    size="lg"
                  />
                </FormControl>

                <Button
                  type="submit"
                  colorScheme="blue"
                  size="lg"
                  width="100%"
                  isLoading={loading}
                  mt={4}
                >
                  تسجيل الدخول
                </Button>
              </Stack>
            </form>
          </Box>

          <Text fontSize="sm" color="gray.500">
            اسم المستخدم:  | كلمة المرور: 
          </Text>
        </VStack>
      </Container>
    </Box>
  );
};

export default Login;




