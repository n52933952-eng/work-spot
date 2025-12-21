import React, { useState, useEffect, useCallback } from 'react';
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
  Input,
  Select,
  SimpleGrid,
  Icon,
} from '@chakra-ui/react';
import { FiEdit2, FiRefreshCw, FiUsers } from 'react-icons/fi';
import MainLayout from '../components/Layout/MainLayout';
import { dashboardAPI, BASE_URL } from '../services/api';
import useSocket from '../hooks/useSocket';

const Employees = () => {
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const toast = useToast();

  const [formData, setFormData] = useState({
    position: '',
    department: '',
    role: 'employee',
    isActive: true,
  });

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterDepartment) params.department = filterDepartment;
      if (filterRole) params.role = filterRole;
      if (filterStatus !== '') params.isActive = filterStatus === 'active';
      
      const response = await dashboardAPI.getAllEmployees(params);
      setEmployees(response.employees || []);
    } catch (error) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل جلب الموظفين',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [filterDepartment, filterRole, filterStatus, toast]);

  // Setup Socket.io to listen for new employee registrations
  const handleEmployeeApproved = useCallback((data) => {
    console.log('📢 New employee approved:', data);
    toast({
      title: 'موظف جديد',
      description: 'تمت الموافقة على موظف جديد',
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
    // Refresh employees list
    fetchEmployees();
  }, [fetchEmployees, toast]);

  useSocket(
    () => {
      console.log('✅ Socket connected in Employees');
    },
    () => {
      console.log('❌ Socket disconnected in Employees');
    },
    {
      employeeApproved: handleEmployeeApproved
    }
  );

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleOpenEdit = (employee) => {
    setSelectedEmployee(employee);
    setFormData({
      position: employee.position || '',
      department: employee.department || '',
      role: employee.role || 'employee',
      isActive: employee.isActive !== false,
    });
    onEditOpen();
  };

  const handleUpdateEmployee = async () => {
    if (!selectedEmployee) return;

    setProcessing(true);
    try {
      await dashboardAPI.updateEmployee(selectedEmployee._id, formData);
      toast({
        title: 'نجح',
        description: 'تم تحديث بيانات الموظف بنجاح',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      onEditClose();
      fetchEmployees();
    } catch (error) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل تحديث بيانات الموظف',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setProcessing(false);
    }
  };

  const getProfileImageUrl = (profileImage) => {
    if (!profileImage) return null;
    if (profileImage.startsWith('http')) return profileImage;
    return `${BASE_URL}${profileImage}`;
  };

  const getRoleLabel = (role) => {
    const roles = {
      employee: { label: 'موظف', color: 'blue' },
      hr: { label: 'موارد بشرية', color: 'purple' },
      manager: { label: 'مدير', color: 'orange' },
      admin: { label: 'مدير عام', color: 'red' },
    };
    return roles[role] || roles.employee;
  };

  // Get unique departments for filter
  const departments = [...new Set(employees.map(emp => emp.department).filter(Boolean))];

  // Filter employees based on filters
  const filteredEmployees = employees.filter(emp => {
    if (filterDepartment && emp.department !== filterDepartment) return false;
    if (filterRole && emp.role !== filterRole) return false;
    if (filterStatus === 'active' && !emp.isActive) return false;
    if (filterStatus === 'inactive' && emp.isActive) return false;
    return true;
  });

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
              إدارة الموظفين
            </Heading>
            <Text 
              fontSize={{ base: "xs", md: "sm" }} 
              color="gray.500"
            >
              إدارة بيانات الموظفين وتحديث الأدوار والمناصب
            </Text>
          </VStack>
          <IconButton
            icon={<FiRefreshCw />}
            aria-label="تحديث"
            onClick={fetchEmployees}
            isLoading={loading}
            colorScheme="blue"
            variant="outline"
            size={{ base: "sm", md: "md" }}
            flex={{ base: "0 0 auto", md: "0 1 auto" }}
          />
        </HStack>

        {/* Filters */}
        <Card mb={6}>
          <CardBody>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
              <FormControl>
                <FormLabel>القسم</FormLabel>
                <Select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  placeholder="جميع الأقسام"
                >
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>الدور</FormLabel>
                <Select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  placeholder="جميع الأدوار"
                >
                  <option value="employee">موظف</option>
                  <option value="hr">موارد بشرية</option>
                  <option value="manager">مدير</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>الحالة</FormLabel>
                <Select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  placeholder="جميع الحالات"
                >
                  <option value="active">نشط</option>
                  <option value="inactive">غير نشط</option>
                </Select>
              </FormControl>
            </SimpleGrid>
          </CardBody>
        </Card>

        {/* Employees Table */}
        {loading ? (
          <Center py={10}>
            <Spinner size="xl" color="blue.500" />
          </Center>
        ) : filteredEmployees.length === 0 ? (
          <Card>
            <CardBody>
              <Center py={10}>
                <VStack spacing={4}>
                  <Icon as={FiUsers} boxSize={12} color="gray.400" />
                  <Text color="gray.500">لا يوجد موظفين</Text>
                </VStack>
              </Center>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody p={{ base: 2, md: 6 }}>
              <TableContainer overflowX="auto" maxW="100%">
                <Table variant="simple" size={{ base: "sm", md: "md" }}>
                  <Thead>
                    <Tr>
                      <Th>الموظف</Th>
                      <Th>رقم الموظف</Th>
                      <Th>البريد الإلكتروني</Th>
                      <Th>القسم</Th>
                      <Th>المنصب</Th>
                      <Th>الدور</Th>
                      <Th>الحالة</Th>
                      <Th>الإجراءات</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {filteredEmployees.map((employee) => {
                      const roleInfo = getRoleLabel(employee.role);
                      return (
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
                            <Badge colorScheme={roleInfo.color}>
                              {roleInfo.label}
                            </Badge>
                          </Td>
                          <Td>
                            <Badge colorScheme={employee.isActive ? 'green' : 'gray'}>
                              {employee.isActive ? 'نشط' : 'غير نشط'}
                            </Badge>
                          </Td>
                          <Td>
                            <IconButton
                              icon={<FiEdit2 />}
                              size="sm"
                              colorScheme="blue"
                              variant="ghost"
                              onClick={() => handleOpenEdit(employee)}
                              aria-label="تعديل"
                            />
                          </Td>
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              </TableContainer>
            </CardBody>
          </Card>
        )}

        {/* Edit Employee Modal */}
        <Modal isOpen={isEditOpen} onClose={onEditClose} size="lg">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>تعديل بيانات الموظف</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              {selectedEmployee && (
                <VStack spacing={4} align="stretch">
                  <HStack>
                    <Avatar
                      size="md"
                      name={selectedEmployee.fullName}
                      src={getProfileImageUrl(selectedEmployee.profileImage)}
                    />
                    <VStack align="start" spacing={0}>
                      <Text fontWeight="bold">{selectedEmployee.fullName}</Text>
                      <Text fontSize="sm" color="gray.600">
                        {selectedEmployee.employeeNumber}
                      </Text>
                    </VStack>
                  </HStack>

                  <FormControl>
                    <FormLabel>المنصب (Position)</FormLabel>
                    <Input
                      value={formData.position}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      placeholder="مثال: مدير المبيعات، مبرمج، IT، مالي"
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>القسم (Department)</FormLabel>
                    <Input
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      placeholder="مثال: المبيعات، البرمجة، IT، المالية"
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>الدور (Role)</FormLabel>
                    <Select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    >
                      <option value="employee">موظف</option>
                      <option value="hr">موارد بشرية</option>
                      <option value="manager">مدير</option>
                      <option value="admin">مدير عام</option>
                    </Select>
                  </FormControl>

                  <FormControl>
                    <FormLabel>الحالة</FormLabel>
                    <Select
                      value={formData.isActive ? 'active' : 'inactive'}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'active' })}
                    >
                      <option value="active">نشط</option>
                      <option value="inactive">غير نشط</option>
                    </Select>
                  </FormControl>
                </VStack>
              )}
            </ModalBody>

            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={onEditClose}>
                إلغاء
              </Button>
              <Button
                colorScheme="blue"
                onClick={handleUpdateEmployee}
                isLoading={processing}
              >
                حفظ
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Box>
    </MainLayout>
  );
};

export default Employees;

