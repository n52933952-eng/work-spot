import React, { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  useToast,
  Spinner,
  Center,
  Text,
  Card,
  CardBody,
  Table,
  TableContainer,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Button,
  HStack,
  VStack,
  Avatar,
  IconButton,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Textarea,
  Alert,
  AlertIcon,
  Icon,
} from '@chakra-ui/react';
import { FiUserCheck, FiUserX, FiRefreshCw, FiClock } from 'react-icons/fi';
import MainLayout from '../components/Layout/MainLayout';
import { employeeApprovalAPI, BASE_URL } from '../services/api';
import useSocket from '../hooks/useSocket';

const EmployeeApproval = () => {
  const [loading, setLoading] = useState(true);
  const [pendingEmployees, setPendingEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const { isOpen: isRejectOpen, onOpen: onRejectOpen, onClose: onRejectClose } = useDisclosure();
  const toast = useToast();

  // Setup Socket.io to listen for new employee registrations
  useSocket(
    () => {
      console.log('✅ Socket connected in EmployeeApproval');
    },
    () => {
      console.log('❌ Socket disconnected in EmployeeApproval');
    },
    {
      newEmployeeRegistration: (data) => {
        console.log('📢 New employee registration received:', data);
        toast({
          title: 'موظف جديد',
          description: data.message || `موظف جديد ينتظر الموافقة: ${data.employeeName}`,
          status: 'info',
          duration: 5000,
          isClosable: true,
        });
        // Refresh pending employees list
        fetchPendingEmployees();
      }
    }
  );

  useEffect(() => {
    fetchPendingEmployees();
  }, []);

  const fetchPendingEmployees = async () => {
    setLoading(true);
    try {
      const response = await employeeApprovalAPI.getPending();
      setPendingEmployees(response.data || []);
    } catch (error) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل جلب الموظفين المعلقين',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (employeeId) => {
    setProcessing(true);
    try {
      await employeeApprovalAPI.approve(employeeId);
      toast({
        title: 'نجح',
        description: 'تمت الموافقة على الموظف بنجاح',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      fetchPendingEmployees();
    } catch (error) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل الموافقة على الموظف',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedEmployee) return;

    setProcessing(true);
    try {
      await employeeApprovalAPI.reject(selectedEmployee._id, rejectionReason);
      toast({
        title: 'نجح',
        description: 'تم رفض الموظف بنجاح',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      onRejectClose();
      setRejectionReason('');
      setSelectedEmployee(null);
      fetchPendingEmployees();
    } catch (error) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل رفض الموظف',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setProcessing(false);
    }
  };

  const openRejectModal = (employee) => {
    setSelectedEmployee(employee);
    setRejectionReason('');
    onRejectOpen();
  };

  const getProfileImageUrl = (profileImage) => {
    if (!profileImage) return null;
    if (profileImage.startsWith('http')) return profileImage;
    return `${BASE_URL}${profileImage}`;
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('ar-JO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <MainLayout>
      <Box w="100%" maxW="100%" overflowX="hidden" boxSizing="border-box">
        <HStack 
          justify="space-between" 
          mb={6} 
          flexWrap="wrap" 
          spacing={{ base: 2, md: 4 }}
          pl={{ base: 12, md: 0 }}
        >
          <VStack align="start" spacing={1} flex={{ base: "1 1 100%", md: "0 1 auto" }}>
            <Heading 
              color="gray.700"
              fontSize={{ base: "lg", md: "xl", lg: "2xl" }}
            >
              الموافقة لموظف جديد
            </Heading>
            <Text 
              fontSize={{ base: "xs", md: "sm" }} 
              color="gray.500"
            >
              الموظفون الجدد ينتظرون موافقتك للوصول إلى النظام
            </Text>
          </VStack>
          <IconButton
            icon={<FiRefreshCw />}
            aria-label="تحديث"
            onClick={fetchPendingEmployees}
            isLoading={loading}
            colorScheme="blue"
            variant="outline"
            size={{ base: "sm", md: "md" }}
            flex={{ base: "0 0 auto", md: "0 1 auto" }}
          />
        </HStack>

        {loading ? (
          <Center py={10}>
            <Spinner size="xl" color="blue.500" />
          </Center>
        ) : pendingEmployees.length === 0 ? (
          <Card>
            <CardBody>
              <Center py={10}>
                <VStack spacing={4}>
                  <Icon as={FiUserCheck} boxSize={12} color="gray.400" />
                  <Text color="gray.500">لا توجد طلبات موافقة معلقة</Text>
                  <Text fontSize="sm" color="gray.400">
                    جميع الموظفين الجدد تمت الموافقة عليهم
                  </Text>
                </VStack>
              </Center>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody p={{ base: 2, md: 6 }}>
              <Alert status="info" mb={4}>
                <AlertIcon />
                <Text>
                  يوجد {pendingEmployees.length} موظف جديد ينتظر الموافقة
                </Text>
              </Alert>

              <TableContainer overflowX="auto" maxW="100%">
                <Table variant="simple" size={{ base: "sm", md: "md" }}>
                <Thead>
                  <Tr>
                    <Th>الموظف</Th>
                    <Th>رقم الموظف</Th>
                    <Th>البريد الإلكتروني</Th>
                    <Th>القسم</Th>
                    <Th>المنصب</Th>
                    <Th>تاريخ التسجيل</Th>
                    <Th>الإجراءات</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {pendingEmployees.map((employee) => (
                    <Tr key={employee._id}>
                      <Td>
                        <HStack spacing={3}>
                          <Avatar
                            size="sm"
                            name={employee.fullName}
                            src={getProfileImageUrl(employee.profileImage)}
                          />
                          <Text fontWeight="medium">{employee.fullName}</Text>
                        </HStack>
                      </Td>
                      <Td>
                        <Text>{employee.employeeNumber}</Text>
                      </Td>
                      <Td>
                        <Text fontSize="sm" color="gray.600">
                          {employee.email}
                        </Text>
                      </Td>
                      <Td>
                        <Badge colorScheme="blue">
                          {employee.department || 'غير محدد'}
                        </Badge>
                      </Td>
                      <Td>
                        <Text fontSize="sm">{employee.position || '-'}</Text>
                      </Td>
                      <Td>
                        <HStack spacing={2}>
                          <Icon as={FiClock} color="gray.400" />
                          <Text fontSize="sm" color="gray.600">
                            {formatDate(employee.createdAt)}
                          </Text>
                        </HStack>
                      </Td>
                      <Td>
                        <HStack spacing={2} flexWrap="wrap">
                          <Button
                            leftIcon={<FiUserCheck />}
                            colorScheme="green"
                            size={{ base: "xs", md: "sm" }}
                            onClick={() => handleApprove(employee._id)}
                            isLoading={processing}
                          >
                            موافقة
                          </Button>
                          <Button
                            leftIcon={<FiUserX />}
                            colorScheme="red"
                            size={{ base: "xs", md: "sm" }}
                            variant="outline"
                            onClick={() => openRejectModal(employee)}
                            isLoading={processing}
                          >
                            رفض
                          </Button>
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
              </TableContainer>
            </CardBody>
          </Card>
        )}

        {/* Reject Modal */}
        <Modal isOpen={isRejectOpen} onClose={onRejectClose} size="md">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>رفض الموظف</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              {selectedEmployee && (
                <VStack spacing={4} align="stretch">
                  <Alert status="warning">
                    <AlertIcon />
                    <Text fontSize="sm">
                      هل أنت متأكد من رفض {selectedEmployee.fullName}؟ لن يتمكن من تسجيل الدخول بعد الرفض.
                    </Text>
                  </Alert>
                  <FormControl>
                    <FormLabel>سبب الرفض (اختياري)</FormLabel>
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="أدخل سبب الرفض..."
                      rows={4}
                    />
                  </FormControl>
                </VStack>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={onRejectClose}>
                إلغاء
              </Button>
              <Button
                colorScheme="red"
                onClick={handleReject}
                isLoading={processing}
              >
                رفض
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Box>
    </MainLayout>
  );
};

export default EmployeeApproval;

