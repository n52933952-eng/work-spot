import { Box, VStack, Button, Text, Icon, Divider } from '@chakra-ui/react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FiUsers,
  FiFileText,
  FiAward,
  FiCalendar,
  FiClock,
  FiBell,
  FiLogOut
} from 'react-icons/fi';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { path: '/dashboard', label: 'الموظفين', icon: FiUsers },
    { path: '/reports', label: 'التقارير', icon: FiFileText },
    { path: '/points', label: 'النقاط', icon: FiAward },
    { path: '/holidays', label: 'العطل', icon: FiCalendar },
    { path: '/leaves', label: 'الإجازات الشخصية', icon: FiClock },
    { path: '/announcements', label: 'الإعلانات', icon: FiBell },
  ];

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate('/');
  };

  return (
    <Box
      bg="blue.600"
      color="white"
      w="250px"
      h="100vh"
      position="fixed"
      left={0}
      top={0}
      p={6}
      boxShadow="lg"
    >
      <VStack align="stretch" spacing={0}>
        {/* Logo/Title */}
        <Box mb={8}>
          <Text fontSize="2xl" fontWeight="bold" textAlign="center">
            لوحة التحكم
          </Text>
          <Text fontSize="sm" textAlign="center" opacity={0.8} mt={1}>
            نظام إدارة الحضور
          </Text>
        </Box>

        <Divider borderColor="blue.400" mb={6} />

        {/* Menu Items */}
        <VStack align="stretch" spacing={2}>
          {menuItems.map((item) => (
            <Button
              key={item.path}
              onClick={() => navigate(item.path)}
              bg={location.pathname === item.path ? 'blue.700' : 'transparent'}
              color="white"
              justifyContent="flex-start"
              leftIcon={<Icon as={item.icon} boxSize={5} />}
              _hover={{ bg: 'blue.700' }}
              _active={{ bg: 'blue.800' }}
              borderRadius="md"
              py={6}
              px={4}
              fontWeight={location.pathname === item.path ? 'bold' : 'normal'}
            >
              {item.label}
            </Button>
          ))}
        </VStack>

        {/* Logout Button */}
        <Box mt="auto" pt={6}>
          <Divider borderColor="blue.400" mb={6} />
          <Button
            onClick={handleLogout}
            bg="red.500"
            color="white"
            justifyContent="flex-start"
            leftIcon={<Icon as={FiLogOut} boxSize={5} />}
            _hover={{ bg: 'red.600' }}
            width="100%"
            borderRadius="md"
            py={6}
          >
            تسجيل الخروج
          </Button>
        </Box>
      </VStack>
    </Box>
  );
};

export default Sidebar;




