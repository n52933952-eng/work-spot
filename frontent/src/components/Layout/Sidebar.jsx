import { 
  Box, 
  VStack, 
  Button, 
  Text, 
  Icon, 
  Divider, 
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  useDisclosure,
  IconButton,
  useBreakpointValue,
  Flex
} from '@chakra-ui/react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FiUsers,
  FiFileText,
  FiAward,
  FiCalendar,
  FiClock,
  FiBell,
  FiDollarSign,
  FiUserCheck,
  FiLogOut,
  FiMenu
} from 'react-icons/fi';
import { useEffect, useRef } from 'react';

const Sidebar = ({ isMobile, isOpen, onClose, onOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const btnRef = useRef();

  const menuItems = [
    { path: '/dashboard', label: 'لوحة التحكم', icon: FiUsers },
    { path: '/employees', label: 'إدارة الموظفين', icon: FiUsers },
    { path: '/employee-approval', label: 'موافقة الموظفين', icon: FiUserCheck },
    { path: '/salary', label: 'الرواتب', icon: FiDollarSign },
    { path: '/reports', label: 'التقارير', icon: FiFileText },
    { path: '/points', label: 'النقاط', icon: FiAward },
    { path: '/holidays', label: 'العطل الرسمية', icon: FiCalendar },
    { path: '/leaves', label: 'الإجازات الشخصية', icon: FiClock },
    { path: '/announcements', label: 'الإعلانات', icon: FiBell },
  ];

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate('/');
  };

  const handleNavigate = (path) => {
    navigate(path);
    if (isMobile) {
      onClose();
    }
  };

  // Sidebar Content Component (reusable for both Desktop and Mobile)
  const SidebarContent = () => (
    <VStack align="stretch" spacing={0} h="100%">
      {/* Logo/Title - Hidden on mobile since DrawerHeader shows it */}
      <Box mb={3} display={{ base: "none", md: "block" }}>
        <Text fontSize={{ base: "lg", md: "2xl" }} fontWeight="bold" textAlign="center">
          لوحة التحكم
        </Text>
        <Text fontSize={{ base: "xs", md: "sm" }} textAlign="center" opacity={0.8} mt={1}>
          نظام إدارة الحضور
        </Text>
      </Box>

      <Divider borderColor="blue.400" mb={3} display={{ base: "none", md: "block" }} />

      {/* Menu Items */}
      <VStack 
        align="stretch" 
        spacing={{ base: 1, md: 2 }} 
        flex={1} 
        overflowY="auto"
        pr={2}
        css={{
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(255, 255, 255, 0.3)',
            borderRadius: '10px',
            '&:hover': {
              background: 'rgba(255, 255, 255, 0.5)',
            },
          },
          'scrollbar-width': 'thin',
          'scrollbar-color': 'rgba(255, 255, 255, 0.3) transparent',
        }}
      >
        {menuItems.map((item) => (
          <Button
            key={item.path}
            onClick={() => handleNavigate(item.path)}
            bg={location.pathname === item.path ? 'blue.700' : 'transparent'}
            color="white"
            justifyContent="flex-start"
            leftIcon={<Icon as={item.icon} boxSize={{ base: 4, md: 5 }} />}
            _hover={{ bg: 'blue.700' }}
            _active={{ bg: 'blue.800' }}
            borderRadius="md"
            py={{ base: 2.5, md: 6 }}
            px={{ base: 3, md: 4 }}
            fontWeight={location.pathname === item.path ? 'bold' : 'normal'}
            fontSize={{ base: "xs", md: "md" }}
          >
            {item.label}
          </Button>
        ))}
      </VStack>

      {/* Logout Button */}
      <Box mt="auto" pt={{ base: 2, md: 4 }}>
        <Divider borderColor="blue.400" mb={{ base: 2, md: 4 }} />
        <Button
          onClick={handleLogout}
          bg="red.500"
          color="white"
          justifyContent="flex-start"
          leftIcon={<Icon as={FiLogOut} boxSize={{ base: 4, md: 5 }} />}
          _hover={{ bg: 'red.600' }}
          width="100%"
          borderRadius="md"
          py={{ base: 2.5, md: 6 }}
          fontSize={{ base: "xs", md: "md" }}
        >
          تسجيل الخروج
        </Button>
      </Box>
    </VStack>
  );

  // Mobile: Drawer
  if (isMobile) {
    return (
      <>
        {/* Hamburger Menu Button */}
        <IconButton
          ref={btnRef}
          aria-label="Open menu"
          icon={<FiMenu />}
          onClick={onOpen}
          position="fixed"
          top={4}
          left={4}
          zIndex={1400}
          bg="blue.600"
          color="white"
          _hover={{ bg: 'blue.700' }}
          boxShadow="md"
        />

        <Drawer
          isOpen={isOpen}
          placement="right"
          onClose={onClose}
          finalFocusRef={btnRef}
        >
          <DrawerOverlay />
          <DrawerContent bg="blue.600" color="white">
            <DrawerCloseButton color="white" />
            <DrawerHeader>
              <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="bold">
                لوحة التحكم
              </Text>
            </DrawerHeader>
            <DrawerBody 
              p={{ base: 4, md: 6 }}
              pt={{ base: 4, md: 6 }}
              css={{
                '&::-webkit-scrollbar': {
                  width: '6px',
                },
                '&::-webkit-scrollbar-track': {
                  background: 'transparent',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: 'rgba(255, 255, 255, 0.3)',
                  borderRadius: '10px',
                  '&:hover': {
                    background: 'rgba(255, 255, 255, 0.5)',
                  },
                },
                'scrollbar-width': 'thin',
                'scrollbar-color': 'rgba(255, 255, 255, 0.3) transparent',
              }}
            >
              <SidebarContent />
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  // Desktop: Fixed Sidebar
  return (
    <Box
      bg="blue.600"
      color="white"
      w="250px"
      h="100vh"
      position="fixed"
      left={0}
      top={0}
      p={{ base: 4, md: 6 }}
      boxShadow="lg"
      zIndex={1000}
    >
      <SidebarContent />
    </Box>
  );
};

export default Sidebar;




